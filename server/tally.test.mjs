import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/tally.mjs', import.meta.url))

// 実物を子プロセスとして叩く。CLI として使われるものは CLI として試験する
const run = (dataDir, args = []) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, CY_DATA_DIR: dataDir },
    encoding: 'utf8',
  })

const seedStore = (records) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cy-tally-'))
  mkdirSync(path.join(dir, 'stories'), { recursive: true })
  records.forEach((record, i) => {
    writeFileSync(path.join(dir, 'stories', `story-${i}.json`), JSON.stringify(record))
  })
  return dir
}

// 個人につながる値をわざと目立つ文字列にして、出力に漏れたら検出できるようにする
const AUTHOR_A = 'authorid-must-not-leak-aaa'
const AUTHOR_B = 'authorid-must-not-leak-bbb'
const HANDLE_A = 'handle_must_not_leak_a'
const HANDLE_B = 'handle_must_not_leak_b'

const SEED = [
  { status: 'public', authorId: AUTHOR_A, authorHandle: HANDLE_A, title: 'a1' },
  { status: 'public', authorId: AUTHOR_A, authorHandle: HANDLE_A, title: 'a2' },
  { status: 'public', authorId: AUTHOR_B, authorHandle: HANDLE_B, title: 'b1' },
  { status: 'public', authorId: AUTHOR_B, authorHandle: HANDLE_B, title: 'b2' },
  { status: 'draft', authorId: AUTHOR_A, authorHandle: HANDLE_A, title: 'a3' },
]

const tokyoToday = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

const utcDay = (offsetDays) => {
  const d = new Date(`${tokyoToday()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

test('公開 Story だけを数え、書き手は人数で数える（下書きは入らない）', () => {
  const result = run(seedStore(SEED))
  assert.equal(result.status, 0)
  assert.match(result.stdout, /公開 Story 4 本 \/ 書き手 2 人/)
})

test('store がまだ無くても 0 件として動く（clone 直後に落ちない）', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cy-tally-empty-'))
  const result = run(path.join(dir, 'no-such-store'))
  assert.equal(result.status, 0)
  assert.match(result.stdout, /公開 Story 0 本 \/ 書き手 0 人/)
})

test('判定日を渡すと残り日数（過去なら超過日数）と目標を出す', () => {
  const dir = seedStore(SEED)
  const future = run(dir, [utcDay(10)])
  assert.equal(future.status, 0)
  assert.match(future.stdout, /残り 10 日/)
  assert.match(future.stdout, /目標: 書き手 10 人・Story 30 本/)

  const past = run(dir, [utcDay(-3)])
  assert.equal(past.status, 0)
  assert.match(past.stdout, /超過 3 日/)
})

test('出力にハンドルも authorId も含まれない（合計だけを出す、の集計保証）', () => {
  const result = run(seedStore(SEED), [utcDay(10)])
  const all = result.stdout + result.stderr
  for (const secret of [AUTHOR_A, AUTHOR_B, HANDLE_A, HANDLE_B]) {
    assert.ok(!all.includes(secret), `個人につながる値が出力に漏れている: ${secret}`)
  }
})

test('不正な日付引数は使い方を出して終了コード 2（store は読まない）', () => {
  for (const bad of ['2026-9-13', '20260913', 'あした', '2026-13-99', '2026-02-30']) {
    const result = run(seedStore(SEED), [bad])
    assert.equal(result.status, 2, `${bad} を受け付けてはいけない`)
    assert.match(result.stderr, /使い方/)
    assert.ok(!result.stdout.includes('公開 Story'), 'store を読む前に止まること')
  }
})

test('読めなかった記録は黙って捨てず件数を出す', () => {
  const dir = seedStore(SEED)
  writeFileSync(path.join(dir, 'stories', 'broken.json'), '{not json')
  const result = run(dir)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /読めなかった記録: 1 件（数に入っていない）/)
  assert.match(result.stdout, /公開 Story 4 本/)
})

// ソース検査: 読み取り専用・ネットワーク不使用の約束をコードの形で縛る
const source = await readFile(SCRIPT, 'utf8')

test('tally.mjs は書き込み API を使わない（読み取り専用の見張り）', () => {
  assert.doesNotMatch(source, /writeFile|rmSync|appendFile|unlink|mkdir/)
})

test('tally.mjs はネットワークを使わない（fetch / http を import しない）', () => {
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /from 'node:https?'/)
  assert.doesNotMatch(source, /require\(['"]https?/)
})

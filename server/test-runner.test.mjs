import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { globSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const RUNNER = path.join(ROOT, 'scripts', 'test-server.mjs')

/**
 * O-5「試験の一覧を手で書くのをやめる」（設計 2026-08-17 10:30）。
 *
 * `package.json` の `test:server` に試験ファイルを 1 本ずつ手で並べていた。
 * **足し忘れると、書いた試験が一度も走らないまま緑に見える。**
 * 2026-08-18 に `server/report-health.test.mjs` が実際にその状態で、
 * **11 件がまるごと走っていなかった**（`2c04c28` で発覚）。
 *
 * ただし glob へ移すと、**もっと危ない穴が開く**:
 *
 *     $ node --test "nosuch/*test.mjs"
 *     # tests 0
 *     終了コード: 0        ← **1 件も無くても緑**
 *
 * 型を打ち間違えただけで「全部通った」に見える。**鳴らない警報**である。
 * **だから床（試験 1）を必ず置く。**glob だけの O-5 は、直すつもりの穴を
 * 自分で開けることになる。
 */

test('拾えた試験が 0 件なら、走らせずに赤で止まる', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'cy-empty-'))
  try {
    const r = spawnSync(process.execPath, [RUNNER], {
      cwd: ROOT,
      env: { ...process.env, CY_TEST_GLOB: path.join(empty, '*test.mjs') },
      encoding: 'utf8',
    })
    assert.notEqual(
      r.status,
      0,
      '0 件のときに緑で終わると、型の打ち間違いが「全部通った」に見える',
    )
    assert.match(
      `${r.stdout}${r.stderr}`,
      /1 件も見つかりません/,
      '何が起きたのかを書かずに落ちると、原因を探すのに時間がかかる',
    )
  } finally {
    rmSync(empty, { recursive: true, force: true })
  }
})

test('拾う数が server/ 直下の試験ファイルの総数と一致する', () => {
  const picked = globSync('server/*test.mjs', { cwd: ROOT })
  const actual = readdirSync(path.join(ROOT, 'server')).filter((n) => /test\.mjs$/.test(n))
  assert.equal(
    picked.length,
    actual.length,
    `glob が ${picked.length} 本・実際は ${actual.length} 本。取りこぼしがある`,
  )
  assert.ok(picked.length > 0, '1 本も拾えていない')
})

test('package.json が個別のファイル名の一覧に戻っていない', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const script = pkg.scripts['test:server']
  assert.doesNotMatch(
    script,
    /\.test\.mjs/,
    '手書きの一覧へ戻っている。足し忘れが黙って起きる状態に逆戻りする',
  )
  assert.match(script, /scripts\/test-server\.mjs/, '走らせ役が差し替わっている')
})

/**
 * **黙って飛ばさない。**何を走らせたのかが画面に出ないと、
 * 「拾えていないファイルがある」ことに人が気づけない。
 * 試験 1 の床は 0 件しか止められず、**1 本だけ拾えている**ような
 * 中途半端な取りこぼしは、この出力を人が見るしかない。
 */
test('走らせるファイルの一覧を画面に出す', () => {
  const out = execFileSync(process.execPath, [RUNNER, '--list-only'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  assert.match(out, /server\/test\.mjs/, '拾ったファイル名が出ていない')
  assert.match(out, /server\/og\.test\.mjs/, '拾ったファイル名が出ていない')
  assert.match(out, /12 本|[0-9]+ 本/, '何本走らせるのかが出ていない')
})

/**
 * **ログインが切れても、書いた 8000 字を失わせない**（U-19）。
 *
 * 期限が切れたトークンで [保存] を押すと、`lib/api.ts` が片づけをして
 * エラー文だけが出ていた。本文は画面に残るが、**入り直すには画面を離れるしかなく、
 * 離れれば本当に消える**（`maxLength={8000}`）。留まれば入り直せない。
 * **どちらを選んでも失う**、というのが直したい形だった。
 *
 * 直し方は**画面を動かさないこと**である。別のタブで入り直せば、
 * `lib/api.ts` は保存のたびにトークンを読み直しているので、
 * **戻ってもう一度押すだけで通る。**仕組みは 1 つも足していない。
 *
 * ここで見るのは 2 つ:
 *   - **引き金が本当に 401 になるか**（本物のサーバーで作る。T-a / T-b）
 *   - **画面が 401 のときだけ案内を出すか**（T-c / T-d / T-e）
 *
 * **期限の数は書き写さない。**`docs/decided-limits.md`（決定の原本）から読む。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { Accounts } from './lib/auth.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const page = read('app/write/page.common.tsx')

/** 註釈は約束ではない（他の網と同じ扱い）。 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

/** 決定の原本から、決めた値を 1 つ読む（T-2 の表）。 */
function decidedValue(name) {
  const m = new RegExp(String.raw`^\|\s*\`${name}\`\s*\|\s*(\d+)\s*\|`, 'm').exec(
    read('docs/decided-limits.md'),
  )
  assert.ok(m, `原本に ${name} が無い`)
  return Number(m[1])
}

/** 名前で始まる本体を、次の行頭の閉じ括弧まで切り出す。 */
function bodyAfter(source, marker, closer) {
  const at = source.indexOf(marker)
  assert.notEqual(at, -1, `${marker} が見つからない（試験の前提が崩れている）`)
  const end = source.indexOf(closer, at)
  assert.notEqual(end, -1, `${marker} の終わりが見つからない`)
  return source.slice(at, end)
}

/**
 * API を 1 つ立てて、終わったら必ず落とす。
 * **港の範囲は他の試験と重ねない**（既存は 8890 / 8910 / 8930 / 8950 /
 * 8970 / 8990 / 9010。重ねると**他人のサーバーに繋いで測る**）。
 */
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
async function withApi(body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-expired-'))
  let child = null
  let base = ''
  try {
    for (let port = 9030; port < 9050 && !base; port += 1) {
      const candidate = spawn(process.execPath, ['server/api.mjs'], {
        cwd: ROOT,
        env: { ...process.env, CY_DATA_DIR: dir, CY_API_PORT: String(port) },
        stdio: 'ignore',
      })
      for (let tries = 0; tries < 40; tries += 1) {
        if (candidate.exitCode !== null) break
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/health`)
          // 答えたのが**自分の子**であることまで見る（先客だと落ちている）
          if (res.ok && candidate.exitCode === null) {
            child = candidate
            base = `http://127.0.0.1:${port}`
            break
          }
        } catch {
          // まだ起きていない
        }
        await wait(50)
      }
      if (!base) candidate.kill('SIGKILL')
    }
    assert.ok(base, 'API を立てられなかった')
    return await body(base, dir)
  } finally {
    child?.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
}

const json = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

/** 1 本書こうとする。返るのは HTTP の番号だけ。 */
async function trySave(base, token) {
  const res = await fetch(`${base}/api/stories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'あ', body: 'い'.repeat(20) }),
  })
  return res.status
}

/**
 * **T-a: 期限が切れたトークンは 401 になる。**
 *
 * 時刻は**時刻差**であって暦日ではない（`payload.exp * 1000 < now()`）。
 * だから**秒を戻して発行するだけ**でよく、日付の文字列も時刻帯も出てこない。
 */
test('【実行】期限が切れたトークンでは書けない（401）', () =>
  withApi(async (base, dir) => {
    const ttl = decidedValue('TOKEN_TTL_SEC')
    const created = await fetch(`${base}/api/auth/register`, json({ handle: 'aki_dev', password: 'correct horse battery' }))
    assert.equal(created.status, 201, '前提の登録が通っていない')

    // **同じ保存領域**に向けて開くので、署名の鍵も同じものになる。
    // now を ttl + 60 秒だけ戻して発行すると、いま見れば既に切れている。
    const past = new Accounts({
      dir: path.join(dir, 'accounts'),
      now: () => Date.now() - (ttl + 60) * 1000,
    })
    const account = past.login({ handle: 'aki_dev', password: 'correct horse battery', clientKey: 'test' })
    const { token } = past.issueToken(account)

    assert.equal(await trySave(base, token), 401, '期限切れのトークンで書けてしまう')
  }))

/**
 * **T-b: 引き金はもう 1 本ある**（⑤ 03:30・①の追記）。
 * **他の端末でパスワードを変えると、手元のトークンが切れる。**
 */
test('【実行】他の端末でパスワードを変えたら、古いトークンでは書けない（401）', () =>
  withApi(async (base) => {
    const created = await fetch(`${base}/api/auth/register`, json({ handle: 'aki_dev', password: 'correct horse battery' }))
    const { token } = await created.json()
    assert.equal(await trySave(base, token), 201, '前提: 変える前は書ける')

    const changed = await fetch(`${base}/api/auth/password`, {
      ...json({ currentPassword: 'correct horse battery', newPassword: 'another long secret' }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })
    assert.equal(changed.status, 200, 'パスワードを変えられていない')

    assert.equal(await trySave(base, token), 401, '古いトークンで書けてしまう')
  }))

/** T-c: 401 のときだけ印を立てている（何で失敗しても立てていない）。 */
test('ログインが切れた印は、401 のときだけ立てる', () => {
  const source = withoutComments(page)
  const marks = [...source.matchAll(/setSessionExpired\(([^\n]*)\)/g)].map((m) => m[1])
  assert.ok(marks.length >= 2, `印を立てる場所が少なすぎる（${marks.length} か所。保存と削除で 2 つ要る）`)
  for (const mark of marks) {
    assert.match(
      mark,
      /status === 401/,
      `401 を見ずに印を立てている（${mark}）。通信不能や 413 で「入り直せ」は嘘になる`,
    )
  }
})

/**
 * T-d: 案内は**印が立っているときだけ**出る。
 *
 * 常設にすると、離脱警告の除外（`link.target === '_blank'`）に
 * **恒久的な抜け道**が 1 本できる。
 */
test('別のタブへの案内は、切れたときだけ出る', () => {
  const source = withoutComments(page)
  const branch = bodyAfter(source, '{sessionExpired && (', '\n      )}')
  assert.match(branch, /target="_blank"/, '案内が別のタブで開かない（この画面を離れてしまう）')
  assert.match(branch, /rel="noopener"/, 'rel="noopener" が無い')
  assert.match(branch, /href="\/login\//, 'ログインへの道が無い')

  // 枝の外に `target="_blank"` が無いこと＝常設になっていないこと
  const outside = source.replace(branch, ' ')
  assert.ok(
    !/target="_blank"/.test(outside),
    '書く画面に、常設の target="_blank" がある（離脱警告の効かない道になる）',
  )
})

/** T-e: 文言を画面に直書きしていない（一覧から取る）。 */
test('切れたときの文言を、画面に直書きしていない', () => {
  assert.match(page, /DEVICE_STORAGE_SESSION_EXPIRED\b/, '画面が一覧の文言を使っていない')
  const table = read('lib/device-storage.ts')
  assert.match(table, /export const DEVICE_STORAGE_SESSION_EXPIRED\b/, '一覧に文言が無い')
  assert.ok(
    !withoutComments(page).includes('ログインが切れました'),
    '画面に文言を直書きしている（一覧から取ること）',
  )
})

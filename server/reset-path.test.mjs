/**
 * パスワードを忘れた人の道（設計 U-10）。
 *
 * ①が 2026-08-20 に実物を歩いて測った。**メールは任意**（SPEC §1）なので、
 * 省く人は必ず出る。省いた人は**忘れた時点で自分では入り直せない**。
 * ところが登録の面は「パスワードを忘れたときの再設定にだけ使います」と
 * **用途しか言っていなかった** —— 省いた人は「何も失っていない」と読む。
 *
 * もう 1 つ。**本番はいまメール送信が未設定**（`/api/health` の `mail` が
 * `false`）で、再設定は受け付けられない。断り自体は誠実だが、
 * **入れなくなった人にハンドルを打たせてから言っていた。**
 *
 * `/api/health` は api.mjs の一覧に「**UI が事前に確認する**」と書いてある
 * 経路で、まさにこの用途。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

const signup = await read('app/signup/page.common.tsx')
const reset = await read('app/reset/page.common.tsx')

test('登録の面が、メールを省いたときに何が起きるかを言っている', () => {
  const optional = signup.slice(signup.indexOf('<details'), signup.indexOf('</details>'))
  const shown = optional
    .split('\n')
    .filter((line) => !/^\s*(\{?\/\*|\*|\/\/)/.test(line))
    .join('\n')
  assert.match(shown, /忘れたときの再設定/, '何に使うかを言っていない')
  assert.match(
    shown,
    /登録しない場合[\s\S]{0,40}入り直せません/,
    '省いたときに何が起きるかを言っていない（用途だけでは「何も失わない」と読める）',
  )
})

test('再設定の面が、受け付けが開いていないことを押す前に言う', () => {
  assert.match(reset, /api<\{ mail\?: boolean \}>\('\/api\/health'\)/, '死活を事前に見ていない')
  const guard = reset.match(/\{mailReady === false && \(([\s\S]*?)\)\}/)
  assert.ok(guard, '受け付けが開いていないときの知らせが無い')
  assert.match(guard[1], /受け付け/, '知らせの中身が空')
})

/**
 * **死活が読めないことを理由に、フォームを止めない。**受け付けは動いて
 * いるのに使えない人が出る（`null` のときは黙る）。
 */
test('死活が読めないときは、黙る（止めない）', () => {
  assert.match(reset, /\.catch\(\(\) => setMailReady\(null\)\)/, '読めないときに状態を戻していない')
  assert.doesNotMatch(reset, /mailReady === null && \(/, '読めないときにも何か言っている')
  assert.doesNotMatch(reset, /disabled=\{[^}]*mailReady/, '死活でフォームを止めている')
})

/** API を 1 つ立てて、終わったら必ず落とす（空いている港を探す）。 */
async function withApi(env, body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-reset-'))
  let child = null
  let base = ''
  try {
    for (let port = 8930; port < 8950 && !base; port += 1) {
      const candidate = spawn(process.execPath, ['server/api.mjs'], {
        cwd: ROOT,
        env: { ...process.env, ...env, CY_DATA_DIR: dir, CY_API_PORT: String(port) },
        stdio: 'ignore',
      })
      for (let tries = 0; tries < 40; tries += 1) {
        if (candidate.exitCode !== null) break
        try {
          if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) {
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
    return await body(base)
  } finally {
    child?.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
}

test('死活が、メールを送れるかどうかを外に出している（面が見るもの）', () =>
  withApi({}, async (base) => {
    const res = await fetch(`${base}/api/health`)
    const body = await res.json()
    assert.equal(
      typeof body.mail,
      'boolean',
      '死活が mail を出していない（面が事前に確かめられない）',
    )
  }))

// 受け付けたふりをしない。**送れないのに 200 を返すと、待っても来ない。**
test('送れないときは、受け付けたふりをしない', () =>
  withApi({}, async (base) => {
    const res = await fetch(`${base}/api/auth/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'aki_dev' }),
    })
    assert.ok(res.status >= 400, `送れないのに受け付けている（${res.status}）`)
    const body = await res.json()
    assert.match(String(body.error ?? ''), /連絡/, '次にどうすればよいかを言っていない')
  }))

/**
 * **本物の API を立てて、下書きの持ち出しを確かめる。**
 *
 * ③が 2026-08-19 に数えたところ、**`server/api.mjs` を HTTP として
 * 起動している試験は 1 つも無かった。**store と auth の単体は
 * `server/test.mjs` が見ており、api.mjs は**ソースとして読まれている**
 * だけだった（`report-ui.test.mjs`）。
 *
 * つまり**経路の分岐そのもの**は誰も動かしていない。ここで守っている
 * 約束は、この製品でいちばん外に出てはいけないものである:
 *
 *   > 下書きは本人だけ。**存在も明かさない**（404 に揃える）
 *
 * この分岐が壊れたとき、**画面は何も言わない** —— 下書きが読めるように
 * なっても、読めた人には「読めた」としか見えない。だから実行で確かめる。
 *
 * **書き込みの上限は緩めない。**この試験が出す書き込みは 4 回だけで、
 * 既定の上限（1 分あたり）に遠く届かない。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * API を 1 つ立てて、終わったら必ず落とす。
 *
 * 港は空いているものを探す（決め打ちにすると、前の周の残りが居るときに
 * **前のサーバーを測ってしまう** —— 環境メモに残っている踏み方）。
 */
async function withApi(body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-api-'))
  let child = null
  let base = ''
  try {
    for (let port = 8890; port < 8910 && !base; port += 1) {
      const candidate = spawn(process.execPath, ['server/api.mjs'], {
        cwd: ROOT,
        env: { ...process.env, CY_DATA_DIR: dir, CY_API_PORT: String(port) },
        stdio: 'ignore',
      })
      for (let tries = 0; tries < 40; tries += 1) {
        if (candidate.exitCode !== null) break
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/health`)
          if (res.ok) {
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

const post = async (base, path, body, token) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  assert.ok(res.ok, `${path} → ${res.status} ${JSON.stringify(json)}`)
  return json
}

const get = async (base, path, token) => {
  const res = await fetch(base + path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
  return { status: res.status, body: await res.json() }
}

/** 書き手 2 人・下書き 1 件・公開 1 件を置く（書き込みは 4 回）。 */
async function seed(base) {
  const mine = await post(base, '/api/auth/register', {
    handle: 'aki_dev',
    password: 'demo-passphrase-2026',
  })
  const other = await post(base, '/api/auth/register', {
    handle: 'bito_maker',
    password: 'demo-passphrase-2026',
  })
  const draft = await post(
    base,
    '/api/stories',
    { title: '下書きの記録', body: '確認のための本文です。十文字を超えます。', status: 'draft' },
    mine.token,
  )
  const open = await post(
    base,
    '/api/stories',
    { title: '公開の記録', body: '確認のための本文です。十文字を超えます。', status: 'public' },
    mine.token,
  )
  return { mine: mine.token, other: other.token, draftId: draft.story.id, openId: open.story.id }
}

test('公開した記録は、誰でも取れる', () =>
  withApi(async (base) => {
    const { openId } = await seed(base)
    const res = await get(base, `/api/stories/${openId}.json`)
    assert.equal(res.status, 200, '公開が取れない')
    assert.equal(res.body.story.id, openId)
  }))

test('下書きは、本人のトークンでなら取れる', () =>
  withApi(async (base) => {
    const { mine, draftId } = await seed(base)
    const res = await get(base, `/api/stories/${draftId}.json`, mine)
    assert.equal(res.status, 200, '本人が自分の下書きを取れない')
    assert.equal(res.body.story.status, 'draft')
  }))

// ここが本題。**3 つの入口すべてで、同じ答えでなければならない。**
test('他人の下書きは、誰にも渡さない（無い記録と同じ答え）', () =>
  withApi(async (base) => {
    const { other, draftId } = await seed(base)
    const missing = await get(base, '/api/stories/zzzzzzzz.json')

    const anonymous = await get(base, `/api/stories/${draftId}.json`)
    const stranger = await get(base, `/api/stories/${draftId}.json`, other)
    const broken = await get(base, `/api/stories/${draftId}.json`, 'not-a-real-token')

    for (const [who, res] of [
      ['トークン無し', anonymous],
      ['別の人のトークン', stranger],
      ['壊れたトークン', broken],
    ]) {
      assert.equal(res.status, 404, `${who}: 下書きに 404 以外を返している（${res.status}）`)
      assert.deepEqual(
        res.body,
        missing.body,
        `${who}: 「無い記録」と答えが違う（下書きの有無を読み取れる）`,
      )
    }
  }))

// 壊れたトークンで 500 を返すと、それ自体が「何かが在る」合図になる。
test('壊れたトークンでも、機械の故障として返さない', () =>
  withApi(async (base) => {
    const { openId } = await seed(base)
    const res = await get(base, `/api/stories/${openId}.json`, 'not-a-real-token')
    assert.ok(res.status < 500, `公開の取得が壊れたトークンで ${res.status} になっている`)
  }))

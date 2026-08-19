/**
 * **他人の記録を、書き換えたり消したりできないこと。**
 *
 * `server/test.mjs` は `StoryStore.update` / `delete` が本人以外を断る
 * ことを見ている。**断っているのは store で、断らせているのは経路である。**
 * 経路が `me` を渡し忘れる・別の人を渡す・断りを握りつぶす、のどれかが
 * 起きると、**store は正しいまま、外からは書き換えられる。**
 *
 * **2026-08-20 訂正。**PR #59 で「API を実際に立てる形を作った」と書いたが、
 * **その形は `server/test.mjs` に前からあった**（`server.listen(0)`）。
 * この試験に残るのは、**他人が PUT / DELETE を投げたときに断られ、
 * かつ中身が変わっていないこと** —— 既存の通し試験は本人の更新までしか
 * 見ていない。
 *
 * **壊れたときの見え方**: 書き換えた人には成功として見え、
 * 書かれた人は**自分の記録が変わったことに気づく手段が無い**
 * （更新の知らせも履歴も無い）。だから実行で確かめる。
 *
 * **書き込みの上限は緩めない。**この試験が出す書き込みは 1 つの API
 * あたり 5 回までで、既定の上限に遠く届かない。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

/** API を 1 つ立てて、終わったら必ず落とす（空いている港を探す）。 */
async function withApi(body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-own-'))
  let child = null
  let base = ''
  try {
    for (let port = 8910; port < 8930 && !base; port += 1) {
      const candidate = spawn(process.execPath, ['server/api.mjs'], {
        cwd: ROOT,
        env: { ...process.env, CY_DATA_DIR: dir, CY_API_PORT: String(port) },
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

const call = async (base, method, path, { body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

/** 書き手 2 人と、1 人目の公開記録 1 件（書き込み 3 回）。 */
async function seed(base) {
  const mine = await call(base, 'POST', '/api/auth/register', {
    body: { handle: 'aki_dev', password: 'demo-passphrase-2026' },
  })
  const other = await call(base, 'POST', '/api/auth/register', {
    body: { handle: 'bito_maker', password: 'demo-passphrase-2026' },
  })
  const story = await call(base, 'POST', '/api/stories', {
    token: mine.body.token,
    body: { title: '本人の記録', body: '確認のための本文です。十文字を超えます。', status: 'public' },
  })
  // **状態の番号を当てにいかない。**置けたかどうかだけを見る（作成は 201
  // を返す。最初 200 と書いて、正しい実装のほうを赤くした）。
  assert.ok(story.status < 400, `置けなかった: ${story.status} ${JSON.stringify(story.body)}`)
  return { mine: mine.body.token, other: other.body.token, id: story.body.story.id }
}

const titleOf = async (base, id) => (await call(base, 'GET', `/api/stories/${id}.json`)).body.story.title

test('他人の記録は、書き換えられない（中身も変わらない）', () =>
  withApi(async (base) => {
    const { other, id } = await seed(base)
    const before = await titleOf(base, id)

    const res = await call(base, 'PUT', `/api/stories/${id}`, {
      token: other,
      body: { title: '横から書き換えた', body: '確認のための本文です。十文字を超えます。', status: 'public' },
    })

    assert.ok(res.status >= 400, `他人の書き換えが通っている（${res.status}）`)
    assert.equal(await titleOf(base, id), before, '断られたのに中身が変わっている')
  }))

test('他人の記録は、消せない（残っている）', () =>
  withApi(async (base) => {
    const { other, id } = await seed(base)

    const res = await call(base, 'DELETE', `/api/stories/${id}`, { token: other })

    assert.ok(res.status >= 400, `他人の削除が通っている（${res.status}）`)
    const after = await call(base, 'GET', `/api/stories/${id}.json`)
    assert.ok(after.status < 400, '断られたのに記録が消えている')
  }))

// トークンが無いときは、そもそも誰なのか分からない。**認証が要る**と
// 言い切る（403 ではなく 401 の側）。
test('トークン無しでは、書き換えも削除もできない', () =>
  withApi(async (base) => {
    const { id } = await seed(base)
    for (const method of ['PUT', 'DELETE']) {
      const res = await call(base, method, `/api/stories/${id}`, {
        ...(method === 'PUT'
          ? { body: { title: '名無しの書き換え', body: '確認のための本文です。十文字を超えます。' } }
          : {}),
      })
      assert.ok(res.status >= 400, `${method}: トークン無しで通っている（${res.status}）`)
    }
    assert.ok((await call(base, 'GET', `/api/stories/${id}.json`)).status < 400, '記録が消えている')
  }))

test('本人なら、書き換えられる（断りが強すぎないこと）', () =>
  withApi(async (base) => {
    const { mine, id } = await seed(base)
    const res = await call(base, 'PUT', `/api/stories/${id}`, {
      token: mine,
      body: { title: '本人が直した', body: '確認のための本文です。十文字を超えます。', status: 'public' },
    })
    assert.ok(res.status < 400, `本人が直せない（${res.status} ${JSON.stringify(res.body)}）`)
    assert.equal(await titleOf(base, id), '本人が直した', '直したのに反映されていない')
  }))

/**
 * 自分の一覧は**下書きを含む**面なので、2 つとも見る:
 *   トークン無しでは返さない ／ 他人の記録が混ざらない
 *
 * **最初は後者しか見ていなかった。**「トークン無しでも返す」作り変えが
 * 緑のまま通り、**自分の試験が常にトークンを付けていた**ことに気づいた。
 * 断る側を見るには、断られる呼び方をしなければならない。
 */
test('自分の一覧は、トークン無しでは返さない', () =>
  withApi(async (base) => {
    await seed(base)
    const res = await call(base, 'GET', '/api/mine')
    assert.ok(res.status >= 400, `トークン無しで自分の一覧が返っている（${res.status}）`)
  }))

test('自分の一覧に、他人の記録は入らない', () =>
  withApi(async (base) => {
    const { other, id } = await seed(base)
    const res = await call(base, 'GET', '/api/mine', { token: other })
    assert.ok(res.status < 400, `自分の一覧が取れない（${res.status}）`)
    const ids = (res.body.stories ?? []).map((s) => s.id)
    assert.ok(!ids.includes(id), '他人の記録が自分の一覧に入っている')
  }))

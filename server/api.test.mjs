import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

import { createApiServer } from './api.mjs'

let server
let base

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-api-'))
  server = createApiServer({ dir: path.join(dir, 'users') })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

async function post(pathName, body, headers = {}) {
  const res = await fetch(`${base}${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

test('health が生きている', async () => {
  const res = await fetch(`${base}/api/health`)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(await res.json(), { ok: true })
})

test('登録 → ログイン → me の流れが通る', async () => {
  const reg = await post('/api/auth/register', { handle: 'writer1', password: 'correct-horse-1' })
  assert.equal(reg.status, 201)
  assert.equal(reg.body.account.handle, 'writer1')
  assert.ok(reg.body.token.startsWith('v1.'))
  // 応答にパスワードやハッシュが混ざらないこと
  assert.equal(JSON.stringify(reg.body).includes('password'), false)

  const login = await post('/api/auth/login', { handle: 'writer1', password: 'correct-horse-1' })
  assert.equal(login.status, 200)

  const me = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${login.body.token}` },
  })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).account.handle, 'writer1')
})

test('重複登録は 409', async () => {
  await post('/api/auth/register', { handle: 'writer2', password: 'correct-horse-1' })
  const dup = await post('/api/auth/register', { handle: 'writer2', password: 'correct-horse-1' })
  assert.equal(dup.status, 409)
})

test('誤パスワードは 401 で、不在ハンドルと同じ文言', async () => {
  await post('/api/auth/register', { handle: 'writer3', password: 'correct-horse-1' })
  const wrong = await post('/api/auth/login', { handle: 'writer3', password: 'wrong-password-1' })
  const nobody = await post('/api/auth/login', { handle: 'nobody-x', password: 'wrong-password-1' })
  assert.equal(wrong.status, 401)
  assert.equal(nobody.status, 401)
  assert.equal(wrong.body.error, nobody.body.error)
})

test('me はトークン無し・改ざんトークンとも 401', async () => {
  const none = await fetch(`${base}/api/auth/me`)
  assert.equal(none.status, 401)
  const reg = await post('/api/auth/register', { handle: 'writer4', password: 'correct-horse-1' })
  const [v, body] = reg.body.token.split('.')
  const forged = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${v}.${body}.AAAA` },
  })
  assert.equal(forged.status, 401)
})

test('JSON でない body は 400、Content-Type 違いは 415', async () => {
  const broken = await post('/api/auth/register', '{手前で壊れたJSON')
  assert.equal(broken.status, 400)
  const wrongType = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'handle=writer5',
  })
  assert.equal(wrongType.status, 415)
})

test('大きすぎる body は拒否する', async () => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: 'writer6', password: 'x'.repeat(20_000) }),
  }).catch(() => null)
  // サーバーは 413 を返すか、読み取りを打ち切る（fetch 側がエラーになる）。
  // どちらでも「受け付けていない」ことに変わりはない。
  if (res) assert.equal(res.status, 413)
})

test('OPTIONS（preflight）が通り、応答に CORS ヘッダが付く', async () => {
  const pre = await fetch(`${base}/api/auth/register`, { method: 'OPTIONS' })
  assert.equal(pre.status, 204)
  assert.ok(pre.headers.get('access-control-allow-methods').includes('POST'))
  const health = await fetch(`${base}/api/health`)
  assert.equal(health.headers.get('access-control-allow-origin'), '*')
})

test('無い経路は 404', async () => {
  const res = await fetch(`${base}/api/nope`)
  assert.equal(res.status, 404)
})

test('タグ: ?tag= の横断絞り込み・tags.json の語彙・不正な tag は 400', async () => {
  const reg = await post('/api/auth/register', { handle: 'tagwriter1', password: 'correct-horse-1' })
  const auth = { Authorization: `Bearer ${reg.body.token}` }
  await post(
    '/api/stories',
    { title: 'タグ付き公開', body: 'b', tags: { tool: ['Godot'] }, visibility: 'public' },
    auth,
  )
  await post('/api/stories', { title: '下書き', body: 'b', tags: { tool: ['hidden-tool'] } }, auth)

  // 正規化された語（godot）で引ける・大文字で問い合わせても同じ
  const hits = await (await fetch(`${base}/api/stories.json?tag=Godot`)).json()
  assert.ok(hits.stories.some((s) => s.title === 'タグ付き公開'))

  const vocab = await (await fetch(`${base}/api/tags.json`)).json()
  assert.ok(vocab.tool.includes('godot'))
  assert.ok(!vocab.tool.includes('hidden-tool'))

  const bad = await fetch(`${base}/api/stories.json?tag=${encodeURIComponent('a/b')}`)
  assert.equal(bad.status, 400)
})

test('RSS: 全体フィードが必須要素を持ち、公開分だけ・エスケープ済みで出る', async () => {
  const reg = await post('/api/auth/register', { handle: 'feedwriter1', password: 'correct-horse-1' })
  const auth = { Authorization: `Bearer ${reg.body.token}` }
  await post(
    '/api/stories',
    { title: 'タグ <script> を書いた日', body: '本文 & 続き', visibility: 'public' },
    auth,
  )
  await post('/api/stories', { title: 'feed に出ない下書き', body: 'b' }, auth)

  const res = await fetch(`${base}/api/feeds/stories.xml`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /application\/rss\+xml/)
  const xml = await res.text()
  // channel の必須 3 要素（事例 18）
  assert.match(xml, /<channel>\s*<title>/)
  assert.match(xml, /<link>/)
  assert.match(xml, /<description>/)
  // エスケープされ、生の <script> が混ざらない
  assert.ok(xml.includes('タグ &lt;script&gt; を書いた日'))
  assert.ok(!xml.includes('<script>'))
  assert.ok(xml.includes('本文 &amp; 続き'))
  // 下書きは出ない
  assert.ok(!xml.includes('feed に出ない下書き'))
  // pubDate は RFC 822 系（toUTCString の形）
  assert.match(xml, /<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4}/)
})

test('RSS: 書き手フィードは本人の公開分だけ、形式外のハンドルは 404', async () => {
  const a = await post('/api/auth/register', { handle: 'feedwriter2', password: 'correct-horse-1' })
  await post(
    '/api/stories',
    { title: 'feedwriter2 の公開', body: 'b', visibility: 'public' },
    { Authorization: `Bearer ${a.body.token}` },
  )
  const xml = await (await fetch(`${base}/api/feeds/w/feedwriter2.xml`)).text()
  assert.ok(xml.includes('feedwriter2 の公開'))
  assert.ok(!xml.includes('タグ &lt;script&gt;'))
  const bad = await fetch(`${base}/api/feeds/w/${encodeURIComponent('../etc')}.xml`)
  assert.equal(bad.status, 404)
})

async function registerWriter(handle) {
  const reg = await post('/api/auth/register', { handle, password: 'correct-horse-1' })
  return { token: reg.body.token, account: reg.body.account }
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` }
}

test('Story: 作成→公開→一覧・1 件取得の流れが通る', async () => {
  const { token } = await registerWriter('storywriter1')
  const created = await post(
    '/api/stories',
    { title: '1 日目', body: '敵の動きを作った', tools: ['Godot'] },
    bearer(token),
  )
  assert.equal(created.status, 201)
  assert.equal(created.body.story.visibility, 'draft')

  const id = created.body.story.id
  const published = await fetch(`${base}/api/stories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...bearer(token) },
    body: JSON.stringify({ title: '1 日目', body: '敵の動きを作った', visibility: 'public' }),
  })
  assert.equal(published.status, 200)

  const list = await fetch(`${base}/api/stories.json`)
  const listBody = await list.json()
  assert.ok(listBody.stories.some((s) => s.id === id))

  const one = await fetch(`${base}/api/stories/${id}.json`)
  assert.equal(one.status, 200)
})

test('Story: 認証なしの作成は 401', async () => {
  const res = await post('/api/stories', { title: 't', body: 'b' })
  assert.equal(res.status, 401)
})

test('Story: 下書きは他人・未ログインから 404、本人からは見える', async () => {
  const mine = await registerWriter('storywriter2')
  const other = await registerWriter('storywriter3')
  const draft = await post('/api/stories', { title: '下書き', body: 'b' }, bearer(mine.token))
  const id = draft.body.story.id

  assert.equal((await fetch(`${base}/api/stories/${id}.json`)).status, 404)
  assert.equal(
    (await fetch(`${base}/api/stories/${id}.json`, { headers: bearer(other.token) })).status,
    404,
  )
  assert.equal(
    (await fetch(`${base}/api/stories/${id}.json`, { headers: bearer(mine.token) })).status,
    200,
  )
  // 他人の更新も 404（存在を明かさない）
  const stolen = await fetch(`${base}/api/stories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...bearer(other.token) },
    body: JSON.stringify({ title: 'x', body: 'y' }),
  })
  assert.equal(stolen.status, 404)
})

test('Story: author 絞り込みは本人の公開分だけ返し、不正な形式は 400', async () => {
  const a = await registerWriter('authorfilter1')
  const b = await registerWriter('authorfilter2')
  await post(
    '/api/stories',
    { title: 'a の公開', body: 'b', visibility: 'public' },
    bearer(a.token),
  )
  await post('/api/stories', { title: 'a の下書き', body: 'b' }, bearer(a.token))
  await post(
    '/api/stories',
    { title: 'b の公開', body: 'b', visibility: 'public' },
    bearer(b.token),
  )

  const list = await (await fetch(`${base}/api/stories.json?author=authorfilter1`)).json()
  assert.equal(list.stories.length, 1)
  assert.equal(list.stories[0].title, 'a の公開')

  const bad = await fetch(`${base}/api/stories.json?author=../etc`)
  assert.equal(bad.status, 400)
})

test('Story: 自分の一覧は下書きを含み、要ログイン', async () => {
  const { token } = await registerWriter('storywriter4')
  await post('/api/stories', { title: '下書きの分', body: 'b' }, bearer(token))
  const mine = await fetch(`${base}/api/mine/stories`, { headers: bearer(token) })
  assert.equal(mine.status, 200)
  assert.equal((await mine.json()).stories.length, 1)
  assert.equal((await fetch(`${base}/api/mine/stories`)).status, 401)
})

// ここから下は designs 2026-08-09 13:21（下書きの読み出しと編集）の認可試験。
// ⑤ 12:51 が「他人の Story を開けないことの確認」を必須と指示した分。

test('自分の一覧に他人の Story は入らない', async () => {
  const a = await registerWriter('mineowner1')
  const b = await registerWriter('mineother1')
  await post('/api/stories', { title: 'a の下書き', body: 'b' }, bearer(a.token))
  await post('/api/stories', { title: 'b の下書き', body: 'b' }, bearer(b.token))

  const listA = await (await fetch(`${base}/api/mine/stories`, { headers: bearer(a.token) })).json()
  const titles = listA.stories.map((s) => s.title)
  assert.deepEqual(titles, ['a の下書き'])
})

test('他人の Story は PUT できず、403 ではなく 404（存在を教えない）', async () => {
  const a = await registerWriter('putowner1')
  const b = await registerWriter('putother1')
  const created = await post(
    '/api/stories',
    { title: 'a のもの', body: 'ほんぶん', visibility: 'draft' },
    bearer(a.token),
  )
  const id = created.body.story.id

  const res = await fetch(`${base}/api/stories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...bearer(b.token) },
    body: JSON.stringify({ title: '乗っ取り', body: 'x', visibility: 'public' }),
  })
  assert.equal(res.status, 404)

  // 中身が変わっていないことも確かめる（404 を返しつつ書き換わっていたら意味がない）
  const still = await (
    await fetch(`${base}/api/mine/stories`, { headers: bearer(a.token) })
  ).json()
  assert.equal(still.stories[0].title, 'a のもの')
  assert.equal(still.stories[0].visibility, 'draft')
})

test('自分の Story の PUT は id・作成日時を変えず、updatedAt だけ進める', async () => {
  const { token } = await registerWriter('putowner2')
  const created = await post(
    '/api/stories',
    { title: 'まえ', body: 'ほんぶん', visibility: 'draft' },
    bearer(token),
  )
  const before = created.body.story

  const res = await fetch(`${base}/api/stories/${before.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...bearer(token) },
    body: JSON.stringify({ title: 'あと', body: 'なおした', visibility: 'public' }),
  })
  assert.equal(res.status, 200)
  const after = (await res.json()).story

  assert.equal(after.id, before.id)
  assert.equal(after.authorHandle, before.authorHandle)
  assert.equal(after.createdAt, before.createdAt)
  assert.equal(after.title, 'あと')
  assert.equal(after.visibility, 'public')
  assert.ok(after.updatedAt >= before.updatedAt)
})

test('CORS の許可メソッドに PUT が入っている（別オリジンから編集できる）', async () => {
  const res = await fetch(`${base}/api/stories/0000000000000000`, { method: 'OPTIONS' })
  const methods = res.headers.get('access-control-allow-methods') ?? ''
  assert.ok(methods.includes('PUT'), `PUT が無い: ${methods}`)
  assert.ok(methods.includes('POST'))
  assert.ok(methods.includes('GET'))
})

// ここから下は designs 2026-08-09 23:45 の分。
// 逆プロキシ（proxy_pass http://127.0.0.1:3010）の下では socket の相手が
// 常に 127.0.0.1 になり、IP 単位のバックオフが全利用者で 1 つになる。
// 誰かが数回わざと失敗させるだけで全員が締め出される、が直前の姿だった。

/** 試験ごとに独立したサーバーを立てる（締めの状態を他の試験に持ち込まない）。 */
async function freshApi(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-api-ip-'))
  const srv = createApiServer({ dir: path.join(dir, 'users'), ...options })
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve))
  const at = `http://127.0.0.1:${srv.address().port}`
  const call = (pathName, body, headers = {}) =>
    fetch(`${at}${pathName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  return { srv, call }
}

const PW = 'correct-horse-1'

test('信じるヘッダを設定すると、締めが相手ごとに分かれる', async () => {
  const { srv, call } = await freshApi({ trustedIpHeader: 'x-real-ip' })
  try {
    await call('/api/auth/register', { handle: 'target1', password: PW })
    await call('/api/auth/register', { handle: 'target2', password: PW })

    // 1.1.1.1 から target1 に 5 回失敗させる
    for (let i = 0; i < 5; i++) {
      await call(
        '/api/auth/login',
        { handle: 'target1', password: 'wrong-password-1' },
        { 'X-Real-IP': '1.1.1.1' },
      )
    }

    // 別の相手（2.2.2.2）は巻き添えにならない
    const other = await call(
      '/api/auth/login',
      { handle: 'target2', password: PW },
      { 'X-Real-IP': '2.2.2.2' },
    )
    assert.equal(other.status, 200, '無関係の利用者が締め出されている')

    // 失敗させた相手は締められている
    const same = await call(
      '/api/auth/login',
      { handle: 'target2', password: PW },
      { 'X-Real-IP': '1.1.1.1' },
    )
    assert.equal(same.status, 429, '総当たりした相手が締められていない')
  } finally {
    srv.close()
  }
})

// ここが逆になると穴が開く。信じない設定でヘッダを読んでしまうと、
// API を直接叩ける相手が毎回違う IP を名乗って締めを素通りできる。
test('信じるヘッダを設定しなければ、ヘッダを付けても無視される', async () => {
  const { srv, call } = await freshApi()
  try {
    await call('/api/auth/register', { handle: 'target1', password: PW })
    await call('/api/auth/register', { handle: 'target2', password: PW })

    // 毎回違う IP を名乗りながら 5 回失敗させる
    for (let i = 0; i < 5; i++) {
      await call(
        '/api/auth/login',
        { handle: 'target1', password: 'wrong-password-1' },
        { 'X-Real-IP': `9.9.9.${i}` },
      )
    }

    // ヘッダを見ていないなら、名乗りを変えても同じ鍵に積まれて締められる
    const res = await call(
      '/api/auth/login',
      { handle: 'target2', password: PW },
      { 'X-Real-IP': '9.9.9.99' },
    )
    assert.equal(res.status, 429, '信じない設定なのにヘッダで締めを回避できている')
  } finally {
    srv.close()
  }
})

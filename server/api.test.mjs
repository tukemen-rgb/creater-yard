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

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { Accounts, AuthError } from './lib/auth.mjs'

/** assert.throws は投げられた例外を返さないので、検査用に取り出す。 */
function capture(fn) {
  try {
    fn()
  } catch (err) {
    return err
  }
  assert.fail('例外が投げられるはずだった')
}

// 時刻は注入できる。TTL の試験で実時間を待たないため。
function setup({ now } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-auth-'))
  const clock = { value: now ?? Date.now() }
  const accounts = new Accounts({
    dir: path.join(base, 'users'),
    now: () => clock.value,
  })
  return { accounts, clock, base }
}

test('登録してログインできる', () => {
  const { accounts } = setup()
  const created = accounts.register({ handle: 'writer1', password: 'correct-horse-1' })
  assert.equal(created.handle, 'writer1')
  // 公開形にパスワードやハッシュが混ざらないこと
  assert.deepEqual(Object.keys(created).sort(), ['createdAt', 'handle', 'id'])
  const logged = accounts.login({ handle: 'writer1', password: 'correct-horse-1' })
  assert.equal(logged.id, created.id)
})

test('誤ったパスワードは 401、文言はハンドル不在時と同じ', () => {
  const { accounts } = setup()
  accounts.register({ handle: 'writer1', password: 'correct-horse-1' })
  const wrongPassword = capture(() => accounts.login({ handle: 'writer1', password: 'wrong-password-1' }))
  const noSuchHandle = capture(() => accounts.login({ handle: 'nobody-here', password: 'wrong-password-1' }))
  assert.ok(wrongPassword instanceof AuthError)
  // ハンドルの実在が応答から分かると総当たりで列挙される
  assert.equal(wrongPassword.message, noSuchHandle.message)
  assert.equal(wrongPassword.status, 401)
})

test('ハンドルの形式違反と重複は登録できない', () => {
  const { accounts } = setup()
  assert.throws(() => accounts.register({ handle: 'NG大文字', password: 'long-enough-1' }), /3〜32文字/)
  assert.throws(() => accounts.register({ handle: 'a', password: 'long-enough-1' }), /3〜32文字/)
  accounts.register({ handle: 'writer1', password: 'long-enough-1' })
  const dup = capture(() => accounts.register({ handle: 'writer1', password: 'long-enough-1' }))
  assert.equal(dup.status, 409)
})

test('短すぎるパスワードは登録できない', () => {
  const { accounts } = setup()
  const err = capture(() => accounts.register({ handle: 'writer1', password: 'short' }))
  assert.ok(err instanceof AuthError)
  assert.equal(err.status, 400)
})

test('トークンは発行→確認が通り、署名をいじると落ちる', () => {
  const { accounts } = setup()
  const account = accounts.register({ handle: 'writer1', password: 'correct-horse-1' })
  const { token } = accounts.issueToken(account)
  assert.equal(accounts.verifyToken(token).handle, 'writer1')
  const [v, body] = token.split('.')
  assert.throws(() => accounts.verifyToken(`${v}.${body}.AAAA`), /署名/)
})

test('期限切れのトークンは落ちる', () => {
  const { accounts, clock } = setup()
  const account = accounts.register({ handle: 'writer1', password: 'correct-horse-1' })
  const { token } = accounts.issueToken(account, 60)
  clock.value += 61_000
  assert.throws(() => accounts.verifyToken(token), /有効期限/)
})

test('tokenEpoch が進んだら古いトークンは落ちる', () => {
  const { accounts, base } = setup()
  const account = accounts.register({ handle: 'writer1', password: 'correct-horse-1' })
  const { token } = accounts.issueToken(account)
  // パスワード変更 API はまだ無いので、変更が起きた状態をファイルで作る
  const file = path.join(base, 'users', 'writer1.json')
  const record = JSON.parse(fs.readFileSync(file, 'utf8'))
  record.tokenEpoch += 1
  fs.writeFileSync(file, JSON.stringify(record))
  assert.throws(() => accounts.verifyToken(token), /パスワードが変更された/)
})

test('ログイン失敗が続くと一時的に締められ、正しい入力でも待たされる', () => {
  const { accounts, clock } = setup()
  accounts.register({ handle: 'writer1', password: 'correct-horse-1' })
  for (let i = 0; i < 5; i++) {
    assert.throws(() => accounts.login({ handle: 'writer1', password: 'wrong-password-1' }))
  }
  const locked = capture(() => accounts.login({ handle: 'writer1', password: 'correct-horse-1' }))
  assert.equal(locked.status, 429)
  // 締めが明ければ本人は入れる
  clock.value += 31_000
  assert.equal(accounts.login({ handle: 'writer1', password: 'correct-horse-1' }).handle, 'writer1')
})

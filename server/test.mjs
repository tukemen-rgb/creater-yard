/**
 * サーバー側の通し試験。`npm run test:server` で実行する。
 *
 * 外部依存なし（node:test）。実データと混ざらないよう、すべて
 * 一時ディレクトリで動かす。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

import { Accounts, AuthError } from './lib/auth.mjs'
import { Gate, RateLimitError } from './lib/gate.mjs'
import { StoryStore, StoryError } from './lib/stories.mjs'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-test-'))
after(() => fs.rmSync(TMP, { recursive: true, force: true }))

function freshAccounts(name, options = {}) {
  return new Accounts({ dir: path.join(TMP, name, 'accounts'), ...options })
}

function freshStories(name, options = {}) {
  return new StoryStore({ dir: path.join(TMP, name, 'stories'), ...options })
}

// ---- アカウント ----

test('登録 → ログイン → トークン確認が通る', () => {
  const accounts = freshAccounts('auth-basic')
  const created = accounts.register({ handle: 'writer1', password: 'long-enough-pass' })
  assert.equal(created.handle, 'writer1')

  const account = accounts.login({ handle: 'writer1', password: 'long-enough-pass' })
  const { token } = accounts.issueToken(account)
  const verified = accounts.verifyToken(token)
  assert.equal(verified.handle, 'writer1')
})

test('壊れた入力は登録で断る', () => {
  const accounts = freshAccounts('auth-validate')
  assert.throws(() => accounts.register({ handle: 'NG大文字', password: 'long-enough-pass' }), AuthError)
  assert.throws(() => accounts.register({ handle: 'ok-handle', password: 'short' }), AuthError)
  accounts.register({ handle: 'ok-handle', password: 'long-enough-pass' })
  assert.throws(() => accounts.register({ handle: 'ok-handle', password: 'long-enough-pass' }), AuthError)
})

test('パスワード変更で古いトークンが切れる', () => {
  const accounts = freshAccounts('auth-epoch')
  const account = accounts.register({ handle: 'writer2', password: 'first-password-1' })
  const { token: oldToken } = accounts.issueToken(account)
  accounts.changePassword({
    handle: 'writer2',
    currentPassword: 'first-password-1',
    newPassword: 'second-password-2',
  })
  assert.throws(() => accounts.verifyToken(oldToken), AuthError)
})

test('退会するとログインできず、ハンドルはしばらく再登録できない', () => {
  const accounts = freshAccounts('auth-delete')
  accounts.register({ handle: 'leaver', password: 'long-enough-pass' })
  accounts.deleteAccount({ handle: 'leaver', password: 'long-enough-pass' })
  assert.throws(() => accounts.login({ handle: 'leaver', password: 'long-enough-pass' }), AuthError)
  assert.throws(() => accounts.register({ handle: 'leaver', password: 'long-enough-pass' }), AuthError)
})

test('ログイン失敗が続くと一時的に締まる', () => {
  let clock = 1_000_000
  const accounts = freshAccounts('auth-lockout', { now: () => clock })
  accounts.register({ handle: 'victim', password: 'correct-password' })
  for (let i = 0; i < 5; i += 1) {
    assert.throws(() => accounts.login({ handle: 'victim', password: 'wrong-password!', clientKey: 'attacker' }), AuthError)
  }
  // 5 回目以降は正しいパスワードでも 429 で締まる
  assert.throws(
    () => accounts.login({ handle: 'victim', password: 'correct-password', clientKey: 'attacker' }),
    (err) => err instanceof AuthError && err.status === 429,
  )
  // 時間が経てば入れる
  clock += 10 * 60 * 1000
  const account = accounts.login({ handle: 'victim', password: 'correct-password', clientKey: 'attacker' })
  assert.equal(account.handle, 'victim')
})

// ---- Story ストア ----

const AUTHOR = { id: 'author-1', handle: 'author1' }
const OTHER = { id: 'author-2', handle: 'author2' }

test('Story の作成 → 更新 → 削除が本人だけできる', () => {
  const stories = freshStories('story-crud')
  const record = stories.create(AUTHOR, {
    title: '当たり判定で1日溶けた',
    body: 'コライダーのレイヤー設定が原因だった。同じ穴に落ちる人のために書いておく。',
    toolTags: ['Unity'],
    topicTags: ['当たり判定'],
  })
  assert.equal(record.status, 'public')
  assert.equal(record.toolTags[0], 'unity') // NFKC + 小文字化

  assert.throws(() => stories.update(record.id, OTHER, { title: '乗っ取り', body: 'x'.repeat(20) }), StoryError)
  const updated = stories.update(record.id, AUTHOR, {
    title: '当たり判定で1日溶けた（解決）',
    body: record.body,
    status: 'public',
  })
  assert.equal(updated.title, '当たり判定で1日溶けた（解決）')
  assert.equal(updated.publishedAt, record.publishedAt) // 最初の公開時刻を保つ

  assert.throws(() => stories.remove(record.id, OTHER), StoryError)
  stories.remove(record.id, AUTHOR)
  assert.equal(stories.get(record.id), null)
})

test('下書きは一覧に出ず、短い本文でも保存できる', () => {
  const stories = freshStories('story-draft')
  stories.create(AUTHOR, { title: '書きかけ', body: '', status: 'draft' })
  stories.create(AUTHOR, {
    title: '公開分',
    body: '公開には10文字以上の本文が要る、というのを確かめる。',
    status: 'public',
  })
  // 公開で本文が短いのは断る
  assert.throws(() => stories.create(AUTHOR, { title: '短い', body: '短い', status: 'public' }), StoryError)

  const listing = stories.listPublic()
  assert.equal(listing.total, 1)
  assert.equal(listing.stories[0].title, '公開分')
  assert.equal(stories.listByAuthor(AUTHOR.id).length, 2)
})

test('作品リンクは GAMEYARD だけ受ける', () => {
  const stories = freshStories('story-url')
  const ok = stories.create(AUTHOR, {
    title: 'リンクつき',
    body: '作品ページはこちら。制作の記録はこの Story に続く。',
    gameUrl: 'https://play-game-yard.com/games/example/',
  })
  assert.ok(ok.gameUrl.startsWith('https://play-game-yard.com/'))
  for (const bad of ['https://example.com/x', 'http://play-game-yard.com/x', 'javascript:alert(1)']) {
    assert.throws(
      () => stories.create(AUTHOR, { title: 'ng', body: 'x'.repeat(20), gameUrl: bad }),
      StoryError,
    )
  }
})

test('タグ索引はサイト全体の合計を返す', () => {
  const stories = freshStories('story-tags')
  stories.create(AUTHOR, { title: 'a', body: 'x'.repeat(20), toolTags: ['Unity'], topicTags: ['音'] })
  stories.create(OTHER, { title: 'b', body: 'y'.repeat(20), toolTags: ['ｕｎｉｔｙ'], topicTags: ['光'] })
  const index = stories.tagIndex()
  assert.deepEqual(index.tools, [{ tag: 'unity', count: 2 }])
  assert.equal(index.topics.length, 2)
})

test('退会でその人の Story が全部消える', () => {
  const stories = freshStories('story-wipe')
  stories.create(AUTHOR, { title: 'a', body: 'x'.repeat(20) })
  stories.create(AUTHOR, { title: 'b', body: 'y'.repeat(20), status: 'draft' })
  stories.create(OTHER, { title: 'c', body: 'z'.repeat(20) })
  assert.equal(stories.removeByAuthor(AUTHOR.id), 2)
  assert.equal(stories.listPublic().total, 1)
})

// ---- 流量制御 ----

test('書き込みの割当が尽きると 429、読み出しの枠は別勘定', () => {
  let clock = 0
  const gate = new Gate()
  for (let i = 0; i < 20; i += 1) gate.consumeWrite('1.2.3.4', clock)
  assert.throws(() => gate.consumeWrite('1.2.3.4', clock), RateLimitError)
  // 読み出しはまだ通る（バケツを使い回さない）
  gate.consumeRead('1.2.3.4', clock)
  // 別の送信元も通る
  gate.consumeWrite('5.6.7.8', clock)
  // 時間が経てば補充される
  clock += 60_000
  gate.consumeWrite('1.2.3.4', clock)
})

// ---- API（HTTP の通し） ----

test('HTTP: 登録 → 投稿 → 読む → 直す → 退会まで', async () => {
  process.env.CY_DATA_DIR = path.join(TMP, 'api', 'store')
  process.env.CY_API_AUTOSTART = '0'
  const { server } = await import('./api.mjs')
  await new Promise((resolve) => server.listen(0, resolve))
  const base = `http://localhost:${server.address().port}`
  after(() => server.close())

  const call = async (method, p, { token, body } = {}) => {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, data: await res.json() }
  }

  // 登録
  const reg = await call('POST', '/api/auth/register', {
    body: { handle: 'httpwriter', password: 'long-enough-pass' },
  })
  assert.equal(reg.status, 201)
  const token = reg.data.token

  // 公開と下書きを 1 本ずつ
  const pub = await call('POST', '/api/stories', {
    token,
    body: {
      title: '公開の記録',
      body: 'HTTP 経由の通し試験。公開分は誰でも読めることを確かめる。',
      toolTags: ['unity'],
    },
  })
  assert.equal(pub.status, 201)
  const draft = await call('POST', '/api/stories', {
    token,
    body: { title: '下書きの記録', body: '', status: 'draft' },
  })
  assert.equal(draft.status, 201)

  // 一覧には公開分だけ
  const listing = await call('GET', '/api/stories.json')
  assert.equal(listing.data.total, 1)

  // 下書きは他人には 404、本人には返る
  const anon = await call('GET', `/api/stories/${draft.data.story.id}.json`)
  assert.equal(anon.status, 404)
  const own = await call('GET', `/api/stories/${draft.data.story.id}.json`, { token })
  assert.equal(own.status, 200)

  // 個人ページとタグ索引
  const creator = await call('GET', '/api/creators/httpwriter.json')
  assert.equal(creator.data.total, 1)
  const tags = await call('GET', '/api/tags.json')
  assert.deepEqual(tags.data.tools, [{ tag: 'unity', count: 1 }])

  // 認証なしの書き込みは 401
  const noAuth = await call('POST', '/api/stories', { body: { title: 'x', body: 'y'.repeat(20) } })
  assert.equal(noAuth.status, 401)

  // パスワード変更で古いトークンが切れ、新しいトークンが渡る
  const changed = await call('POST', '/api/auth/password', {
    token,
    body: { currentPassword: 'long-enough-pass', newPassword: 'even-longer-pass-2' },
  })
  assert.equal(changed.status, 200)
  const oldMe = await call('GET', '/api/auth/me', { token })
  assert.equal(oldMe.status, 401)
  const newToken = changed.data.token

  // 退会で Story も消える
  const bye = await call('DELETE', '/api/auth/me', {
    token: newToken,
    body: { password: 'even-longer-pass-2' },
  })
  assert.equal(bye.status, 200)
  assert.equal(bye.data.removedStories, 2)
  const after1 = await call('GET', '/api/stories.json')
  assert.equal(after1.data.total, 0)
})

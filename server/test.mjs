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
import { ImageError, inspectImage } from './lib/image.mjs'
import { ImageStore } from './lib/images.mjs'
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

test('パスワード再設定: トークンは 1 回だけ・宛先なしは対象外', () => {
  let clock = 5_000_000
  const accounts = freshAccounts('auth-reset', { now: () => clock })
  accounts.register({ handle: 'hasmail', password: 'first-password-1', contact: 'me@example.com' })
  accounts.register({ handle: 'nomail', password: 'first-password-1' })

  // 宛先の無いアカウントには出さない（呼び出し側は応答を揃える）
  assert.equal(accounts.requestReset({ handle: 'nomail' }), null)
  assert.equal(accounts.requestReset({ handle: 'no-such-user' }), null)

  const request = accounts.requestReset({ handle: 'hasmail' })
  assert.ok(request.token.startsWith('hasmail.'))
  assert.equal(request.contact, 'me@example.com')

  // 直後の再要求は間隔制限で出さない（受信箱を埋めさせない）
  assert.equal(accounts.requestReset({ handle: 'hasmail' }), null)

  // 発行済みトークンは再設定で切れる
  const { token: oldLogin } = accounts.issueToken(
    accounts.login({ handle: 'hasmail', password: 'first-password-1' }),
  )
  const account = accounts.completeReset({ token: request.token, password: 'second-password-2' })
  assert.equal(account.handle, 'hasmail')
  assert.throws(() => accounts.verifyToken(oldLogin), AuthError)
  accounts.login({ handle: 'hasmail', password: 'second-password-2' })

  // 同じトークンは 2 回使えない
  assert.throws(
    () => accounts.completeReset({ token: request.token, password: 'third-password-3' }),
    AuthError,
  )

  // 期限切れは使えない
  clock += 61_000
  const expired = accounts.requestReset({ handle: 'hasmail' })
  clock += 31 * 60 * 1000
  assert.throws(
    () => accounts.completeReset({ token: expired.token, password: 'fourth-password-4' }),
    AuthError,
  )
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

test('公開一覧は各作者の最新1件を一巡してから同じ作者の2件目を出す', () => {
  let clock = 1_000_000
  const stories = freshStories('story-author-interleave', { now: () => clock })
  const THIRD = { id: 'author-3', handle: 'author3' }

  stories.create(AUTHOR, { title: '作者1の古い記録', body: 'a'.repeat(20) })
  clock += 1_000
  stories.create(AUTHOR, { title: '作者1の新しい記録', body: 'b'.repeat(20) })
  clock += 1_000
  stories.create(OTHER, { title: '作者2の記録', body: 'c'.repeat(20) })
  clock += 1_000
  stories.create(THIRD, { title: '作者3の記録', body: 'd'.repeat(20) })

  assert.deepEqual(
    stories.listPublic().stories.map((story) => story.title),
    ['作者3の記録', '作者2の記録', '作者1の新しい記録', '作者1の古い記録'],
  )
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

// ---- 画像 ----

/**
 * 検査対象の PNG をバイト列から組み立てる。
 * 検査はコンテナ構造（IHDR の寸法・チャンク長・IEND での終端）だけを
 * 見るので、CRC やピクセルデータの中身は問われない。
 */
function makePng(width, height, { trailing = 0 } = {}) {
  const chunk = (type, data) => {
    const buf = Buffer.alloc(12 + data.length)
    buf.writeUInt32BE(data.length, 0)
    buf.write(type, 4, 'latin1')
    data.copy(buf, 8)
    return buf
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // ビット深度
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', Buffer.alloc(16)),
    chunk('IEND', Buffer.alloc(0)),
    Buffer.alloc(trailing),
  ])
}

test('画像検査: 正しい PNG は通り、細工されたものは断る', () => {
  const ok = inspectImage(makePng(800, 450))
  assert.equal(ok.format, 'png')
  assert.equal(ok.width, 800)
  assert.equal(ok.height, 450)

  // 多重形式（IEND の後ろにデータ）
  assert.throws(() => inspectImage(makePng(800, 450, { trailing: 32 })), ImageError)
  // 展開爆弾（宣言だけ巨大）
  assert.throws(() => inspectImage(makePng(100_000, 100_000)), ImageError)
  // 小さすぎる
  assert.throws(() => inspectImage(makePng(10, 10)), ImageError)
  // SVG は受けない
  assert.throws(() => inspectImage(Buffer.from('<svg onload="alert(1)"></svg>')), ImageError)
  // 画像ですらない
  assert.throws(() => inspectImage(Buffer.from('just text')), ImageError)
})

test('画像ストア: 本人だけが添付でき、孤児は時間で消える', () => {
  let clock = 1_000_000
  const store = new ImageStore({ dir: path.join(TMP, 'images'), now: () => clock })
  const saved = store.save(makePng(800, 450), { authorId: AUTHOR.id })
  assert.equal(saved.ext, 'png')

  // 他人は添付できない
  assert.throws(() => store.attach(saved.id, { authorId: OTHER.id, storyId: 's1' }), ImageError)
  // 本人は添付できる
  const attached = store.attach(saved.id, { authorId: AUTHOR.id, storyId: 'story-01x' })
  assert.equal(attached.id, saved.id)
  // 別の Story への使い回しは断る
  assert.throws(() => store.attach(saved.id, { authorId: AUTHOR.id, storyId: 'another1' }), ImageError)

  // 孤児（未添付）は TTL を過ぎたら消える。添付済みは残る
  const orphan = store.save(makePng(800, 450), { authorId: AUTHOR.id })
  clock += 25 * 60 * 60 * 1000
  assert.equal(store.pruneOrphans(), 1)
  assert.equal(store.meta(orphan.id), null)
  assert.notEqual(store.meta(saved.id), null)
})

test('つまずき欄: 本文と未解決/解決を持て、本人以外は触れない（SPEC §1）', () => {
  const stories = freshStories('story-hurdle')

  // 既定は未解決
  const made = stories.create(AUTHOR, {
    title: '影が出ない',
    body: 'ライトのモードを間違えていた。丸一日気づかなかった。',
    hurdle: { text: 'リアルタイム影が出ない' },
  })
  assert.equal(made.hurdle.text, 'リアルタイム影が出ない')
  assert.equal(made.hurdle.status, 'open')

  // 保存したものが読み出せる（書いたつもりで消えていない）
  assert.equal(stories.get(made.id).hurdle.status, 'open')

  // 本人は解決へ切り替えられる。**公開状態は巻き添えにならない**
  const fixed = stories.update(made.id, AUTHOR, {
    title: made.title,
    body: made.body,
    hurdle: { text: made.hurdle.text, status: 'resolved' },
  })
  assert.equal(fixed.hurdle.status, 'resolved')
  assert.equal(fixed.status, 'public', 'hurdle.status を触ってもレコードの公開状態は動かない')

  // 本人以外は編集できない（つまずきも道連れで守られる）
  assert.throws(
    () => stories.update(made.id, OTHER, { title: 'x', body: 'よそのStoryを書き換える', hurdle: { text: 'a' } }),
    StoryError,
  )
  assert.equal(stories.get(made.id).hurdle.status, 'resolved')

  // 空で送れば消える（PUT は置き換え）
  const cleared = stories.update(made.id, AUTHOR, { title: made.title, body: made.body })
  assert.equal(cleared.hurdle, null)

  // 上限を超えた本文は切り詰める（緩めない）
  const long = stories.create(AUTHOR, {
    title: '長いつまずき',
    body: '本文はここに十分な長さで書いてある。',
    hurdle: { text: 'あ'.repeat(500) },
  })
  assert.equal(long.hurdle.text.length, 200)
})

// ---- 通報 ----

test('通報: 受付番号が返り、運営が状態を更新できる', async () => {
  const { ReportStore, ReportError } = await import('./lib/reports.mjs')
  const reports = new ReportStore({ dir: path.join(TMP, 'reports') })

  // 壊れた入力は断る
  assert.throws(() => reports.create({ target: '', category: 'copyright', detail: 'x'.repeat(20) }), ReportError)
  assert.throws(() => reports.create({ target: '/story/abc/', category: 'nonsense', detail: 'x'.repeat(20) }), ReportError)
  assert.throws(() => reports.create({ target: '/story/abc/', category: 'copyright', detail: '短い' }), ReportError)

  const { ticket } = reports.create({
    target: '/story/F_4h0rB8/',
    category: 'copyright',
    detail: 'この Story の画像は私が公開しているドット絵素材の無断転載です。',
    contact: 'rights@example.com',
  })
  assert.match(ticket, /^R-[0-9A-Z]{4}-[0-9A-Z]{4}$/)

  const listed = reports.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].status, 'open')

  const updated = reports.update(listed[0].id, { status: 'resolved', note: '該当画像を確認、本人と連絡済み' })
  assert.equal(updated.status, 'resolved')
  assert.equal(reports.list({ status: 'open' }).length, 0)
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

  // メール未設定の環境では、再設定は「使えない」と正直に答える
  const resetOff = await call('POST', '/api/auth/reset', { body: { handle: 'httpwriter' } })
  assert.equal(resetOff.status, 503)

  // 通報は認証なしで出せる。一覧は運営でなければ 404（存在も明かさない）
  const reported = await call('POST', '/api/reports', {
    body: { target: '/story/abc12345/', category: 'spam', detail: '宣伝リンクだけの投稿が並んでいます。' },
  })
  assert.equal(reported.status, 201)
  assert.ok(reported.data.ticket)
  const adminList = await call('GET', '/api/reports', { token })
  assert.equal(adminList.status, 404)

  // 画像: アップロード → Story に添付 → 配信 → 外すと消える
  const imgRes = await fetch(`${base}/api/story-image`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/png' },
    body: makePng(800, 450),
  })
  assert.equal(imgRes.status, 201)
  const { image } = await imgRes.json()
  const withImage = await call('POST', '/api/stories', {
    token,
    body: {
      title: '画像つきの記録',
      body: 'スクリーンショットを添えて、当たり判定の壊れ方を残しておく。',
      imageId: image.id,
    },
  })
  assert.equal(withImage.status, 201)
  assert.equal(withImage.data.story.image.id, image.id)
  const served = await fetch(`${base}/api/images/${image.id}.${image.ext}`)
  assert.equal(served.status, 200)
  assert.equal(served.headers.get('content-type'), 'image/png')
  // 画像を外す（imageId: null）と実体も消える
  const detached = await call('PUT', `/api/stories/${withImage.data.story.id}`, {
    token,
    body: { title: '画像つきの記録', body: withImage.data.story.body, imageId: null },
  })
  assert.equal(detached.data.story.image, null)
  const gone = await fetch(`${base}/api/images/${image.id}.${image.ext}`)
  assert.equal(gone.status, 404)
  // 後続の件数確認が狂わないよう消しておく
  await call('DELETE', `/api/stories/${withImage.data.story.id}`, { token })

  // パスワード変更で古いトークンが切れ、新しいトークンが渡る
  const changed = await call('POST', '/api/auth/password', {
    token,
    body: { currentPassword: 'long-enough-pass', newPassword: 'even-longer-pass-2' },
  })
  assert.equal(changed.status, 200)
  const oldMe = await call('GET', '/api/auth/me', { token })
  assert.equal(oldMe.status, 401)
  const newToken = changed.data.token

  // sitemap: 公開オリジンが決まるまでは出さない。決まれば公開分だけ載る
  delete process.env.CY_SITE_ORIGIN
  const noMap = await fetch(`${base}/sitemap-stories.xml`)
  assert.equal(noMap.status, 404)
  process.env.CY_SITE_ORIGIN = 'https://creatoryard.example'
  const map = await fetch(`${base}/sitemap-stories.xml`)
  assert.equal(map.status, 200)
  assert.equal(map.headers.get('cache-control'), 'no-store')
  const xml = await map.text()
  assert.ok(xml.includes(`https://creatoryard.example/story/${pub.data.story.id}/`))
  assert.ok(xml.includes('https://creatoryard.example/creators/httpwriter/'))
  assert.ok(!xml.includes(draft.data.story.id)) // 下書きは載せない
  delete process.env.CY_SITE_ORIGIN

  // 退会で Story も消える
  const bye = await call('DELETE', '/api/auth/me', {
    token: newToken,
    body: { password: 'even-longer-pass-2' },
  })
  assert.equal(bye.status, 200)
  assert.equal(bye.data.removedStories, 2)
  const after1 = await call('GET', '/api/stories.json')
  assert.equal(after1.data.total, 0)

  // 退会・削除後は、次の sitemap 取得から Story と作者 URL を残さない
  process.env.CY_SITE_ORIGIN = 'https://creatoryard.example'
  const afterDeleteMap = await fetch(`${base}/sitemap-stories.xml`)
  assert.equal(afterDeleteMap.status, 200)
  const afterDeleteXml = await afterDeleteMap.text()
  assert.ok(!afterDeleteXml.includes(`/story/${pub.data.story.id}/`))
  assert.ok(!afterDeleteXml.includes('/creators/httpwriter/'))
  delete process.env.CY_SITE_ORIGIN
})

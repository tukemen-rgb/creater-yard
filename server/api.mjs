#!/usr/bin/env node
/**
 * CreatorYard の API。GAMEYARD（server/api.mjs）と同じ考え方の縮小版。
 *
 * サイト本体は静的書き出しのままにしておき、書き込み（アカウント・Story）
 * だけをこの小さなサービスが受ける。static ホスティングの安さと、
 * サーバー側でしかできない認証・検査を両立させるための分離。
 *
 *   GET    /api/health              死活（UI が事前に確認する）
 *   POST   /api/auth/register       書き手アカウント作成（Bearer トークンを返す）
 *   POST   /api/auth/login          ログイン（Bearer トークンを返す）
 *   GET    /api/auth/me             トークンの確認
 *   POST   /api/auth/reset          パスワード再設定の要求（メールを送る）
 *   POST   /api/auth/reset/confirm  再設定リンクで新しいパスワードにする
 *   POST   /api/auth/password       ログイン中のパスワード変更（要ログイン）
 *   POST   /api/auth/contact        連絡先の変更（要ログイン＋パスワード）
 *   DELETE /api/auth/me             退会。Story もすべて消す（要ログイン＋パスワード）
 *   GET    /api/stories.json        公開 Story の一覧（新着順・絞り込み・ページ送り）
 *   GET    /api/stories/<id>.json   Story 1 件（下書きは本人だけ）
 *   POST   /api/stories             Story を書く（要ログイン）
 *   PUT    /api/stories/<id>        Story を直す（本人のみ）
 *   DELETE /api/stories/<id>        Story を消す（本人のみ）
 *   GET    /api/mine                自分の Story 一覧（下書き含む。要ログイン）
 *   GET    /api/creators/<handle>.json  その人の公開 Story（Timeline の原型）
 *   GET    /api/tags.json           タグ索引（サイト全体の合計値）
 *   POST   /api/story-image         画像の検査と保存（要ログイン。本文とは別送）
 *   GET    /api/images/<id>.<ext>   検査済み画像の配信
 *   GET    /api/feeds/stories.xml   新着の RSS（全ページの alternate から指される）
 *   GET    /api/feeds/creators/<handle>.xml  その人だけの RSS（書き手の面から指される）
 *   GET    /sitemap-stories.xml     公開 Story の sitemap（CY_SITE_ORIGIN 必須）
 *   POST   /api/reports             通報の受付（認証不要）
 *   GET    /api/reports             通報の一覧（運営のみ）
 *   POST   /api/reports/<id>        通報の状態と対応メモの更新（運営のみ）
 *
 * CORS は既定で閉じている。本番は同一オリジン配下（リバースプロキシで
 * /api を寄せる）を想定。開発中だけ CY_ALLOW_ORIGIN=http://localhost:3000
 * のように明示して開ける（無条件に開けると、他サイトに埋め込まれた JS が
 * 利用者のトークンで書き込める）。
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Accounts, AuthError } from './lib/auth.mjs'
import { Gate, RateLimitError, clientKey } from './lib/gate.mjs'
import { buildStoriesFeed, siteOrigin } from './lib/feed.mjs'
import { IMAGE_LIMITS } from './lib/image.mjs'
import { ImageStore, ImageError } from './lib/images.mjs'
import { Mailer } from './lib/mailer.mjs'
import { ReportStore, ReportError, REPORT_CATEGORIES, REPORT_STATUSES } from './lib/reports.mjs'
import { StoryStore, StoryError, STORY_LIMITS, publicStory } from './lib/stories.mjs'

const PORT = Number(process.env.CY_API_PORT ?? 8798)
const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DATA = process.env.CY_DATA_DIR ?? path.join(ROOT, 'store')
const ALLOW_ORIGIN = process.env.CY_ALLOW_ORIGIN ?? ''
const TRUST_PROXY = process.env.CY_TRUST_PROXY === '1'
/** JSON ボディの上限。本文 8000 字＋余白。緩めない（CLAUDE.md）。 */
const MAX_BODY_BYTES = 64 * 1024

const accounts = new Accounts({ dir: path.join(DATA, 'accounts') })
const stories = new StoryStore({ dir: path.join(DATA, 'stories') })
const images = new ImageStore({ dir: path.join(DATA, 'images') })
const reports = new ReportStore({ dir: path.join(DATA, 'reports') })
const gate = new Gate()

/**
 * 運営の判定（GAMEYARD と同じ方式）。CY_ADMIN_HANDLES にカンマ区切りで
 * ハンドルを並べる。通報の閲覧・状態更新だけに使う — Story の削除権限は
 * 持たせていない（必要になったら、その操作を足すときに監査ログとセットで
 * 設計する。権限だけ先に配ると、使った記録が残らない）。
 */
const ADMIN_HANDLES = new Set(
  (process.env.CY_ADMIN_HANDLES ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
)

function requireAdmin(req) {
  const account = accounts.authenticate(req)
  if (!ADMIN_HANDLES.has(account.handle.toLowerCase())) {
    // 存在を明かさない。「運営専用です」と返すと、この URL が運営機能で
    // あることと、自分が運営でないことの両方を確かめられてしまう
    throw new ReportError('見つかりません。', 404)
  }
  return account
}
// メール送信。MAIL_TRANSPORT が未設定なら enabled=false になり、
// 再設定 API は「使えない」と明示する（送れないのに受け付けたふりをしない）
const mailer = new Mailer()
if (mailer.problems.length) {
  for (const problem of mailer.problems) console.error(`mailer: ${problem}`)
}

/**
 * 再設定リンクに使える公開 origin。localhost やパス付き URL をメールへ
 * 混ぜないため、HTTPS の origin そのものだけを受け付ける。
 */
function passwordResetOrigin() {
  const configured = siteOrigin()
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' || url.username || url.password) return ''
    if ((url.pathname && url.pathname !== '/') || url.search || url.hash) return ''
    return url.origin
  } catch {
    return ''
  }
}

function passwordResetAvailable() {
  return mailer.enabled && Boolean(passwordResetOrigin())
}

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/

function send(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(payload)
}

/** JSON 以外（RSS など）をそのまま返す。send() は必ず JSON 化するので使えない。 */
function sendRaw(res, status, body, contentType) {
  res.writeHead(status, {
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sendError(res, err) {
  if (err instanceof RateLimitError) {
    send(res, 429, { error: err.message }, { 'retry-after': String(err.retryAfterSec ?? 60) })
    return
  }
  const known =
    err instanceof AuthError ||
    err instanceof StoryError ||
    err instanceof ImageError ||
    err instanceof ReportError
  if (known) {
    send(res, err.status ?? 400, { error: err.message })
    return
  }
  // 予期しない失敗の詳細は外に出さない（内部のパスやスタックは攻撃の地図になる）
  console.error(err)
  send(res, 500, { error: 'サーバー側で問題が起きました。時間をおいてお試しください。' })
}

/** JSON ボディを上限つきで読む。超えたら即切る（溜め込ませない）。 */
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new StoryError('リクエストが大きすぎます。', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new StoryError('リクエストの JSON が読めません。'))
      }
    })
    req.on('error', reject)
  })
}

/** 生のボディを上限つきで読む（画像用）。超えたら即切る。 */
function readRaw(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(
          new ImageError(
            `画像のサイズが上限（${Math.floor(maxBytes / 1024 / 1024)}MB）を超えています。`,
            413,
          ),
        )
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Story への添付画像の解決。
 *
 * imageId は undefined（変更なし）・null か空文字（外す）・文字列（設定）の
 * 3 通り。所有者の確認は images 側で行う。返り値は stories.update の
 * options.image にそのまま渡せる形。
 */
function resolveImage(imageId, me, current) {
  if (imageId === undefined) return { image: undefined, removed: null }
  if (imageId === null || imageId === '') {
    return { image: null, removed: current?.id ?? null }
  }
  if (typeof imageId !== 'string') throw new ImageError('画像の指定が正しくありません。')
  if (current?.id === imageId) return { image: undefined, removed: null }
  const meta = images.meta(imageId)
  if (!meta) throw new ImageError('画像が見つかりません。アップロードし直してください。', 404)
  if (meta.authorId !== me.id) throw new ImageError('この画像を使えるのは本人だけです。', 403)
  return {
    image: { id: meta.id, ext: meta.ext, width: meta.width, height: meta.height },
    removed: current?.id ?? null,
  }
}

/** 開発用 CORS。CY_ALLOW_ORIGIN と一致した Origin にだけ開ける。 */
function applyCors(req, res) {
  if (!ALLOW_ORIGIN) return false
  const origin = req.headers.origin
  if (origin !== ALLOW_ORIGIN) return false
  res.setHeader('access-control-allow-origin', ALLOW_ORIGIN)
  res.setHeader('vary', 'origin')
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-methods': 'GET,POST,PUT,DELETE',
      'access-control-allow-headers': 'authorization,content-type,x-filename',
      'access-control-max-age': '600',
    })
    res.end()
    return true
  }
  return false
}

/** トークンがあれば本人、なければ null。読み出しの「本人なら下書きも」用。 */
function maybeAccount(req) {
  if (!req.headers.authorization) return null
  try {
    return accounts.authenticate(req)
  } catch {
    return null
  }
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname.replace(/\/+$/, '') || '/'
  const key = clientKey(req, { trustProxy: TRUST_PROXY })
  const isRead = req.method === 'GET'
  if (isRead) gate.consumeRead(key)
  else gate.consumeWrite(key)

  // ---- 死活 ----
  if (req.method === 'GET' && p === '/api/health') {
    // mail は再設定機能が使えるかどうか。UI がこれを見て案内を変えられる
    send(res, 200, { ok: true, service: 'creatoryard-api', mail: passwordResetAvailable() })
    return
  }

  // ---- アカウント ----
  if (req.method === 'POST' && p === '/api/auth/register') {
    const body = await readJson(req)
    const account = accounts.register({
      handle: body.handle,
      password: body.password,
      contact: body.contact,
    })
    const token = accounts.issueToken(account)
    send(res, 201, { account, ...token })
    return
  }

  if (req.method === 'POST' && p === '/api/auth/login') {
    const body = await readJson(req)
    const account = accounts.login({
      handle: body.handle,
      password: body.password,
      clientKey: key,
    })
    const token = accounts.issueToken(account)
    send(res, 200, { account, ...token })
    return
  }

  if (req.method === 'GET' && p === '/api/auth/me') {
    send(res, 200, { account: accounts.authenticate(req) })
    return
  }

  if (req.method === 'POST' && p === '/api/auth/reset') {
    const origin = passwordResetOrigin()
    if (!mailer.enabled || !origin) {
      // 送れないのに受け付けたふりはしない。ここは存在を漏らさない
      // （ハンドルを見る前に返している）
      send(res, 503, {
        error:
          'このサイトではパスワード再設定の準備が完了していないため、受け付けられません。運営（Issue か X の @sidra_studio）までご連絡ください。',
      })
      return
    }
    const body = await readJson(req)
    const request = accounts.requestReset({ handle: body.handle })
    if (request) {
      const link = `${origin}/reset/?t=${encodeURIComponent(request.token)}`
      mailer.sendInBackground({
        to: request.contact,
        subject: 'CreatorYard パスワード再設定',
        text: [
          `${body.handle} さんのパスワード再設定が要求されました。`,
          '',
          '次のリンクを開いて新しいパスワードを設定してください。',
          link,
          '',
          `このリンクは ${request.ttlMinutes} 分で使えなくなります。1 回だけ使えます。`,
          '',
          '心当たりがない場合は、このメールを破棄してください。',
          'リンクを開かなければパスワードは変わりません。',
        ].join('\n'),
      })
    }
    // 実在しないハンドル・宛先なしでも同じ応答。ここで区別すると
    // 「どのハンドルが存在するか」を総当たりで調べられる
    send(res, 200, {
      accepted: true,
      message:
        '受け付けました。登録時にメールアドレスを設定している場合は、再設定用のリンクを送ります。数分待っても届かない場合は、登録した連絡先を確認してください。',
    })
    return
  }

  if (req.method === 'POST' && p === '/api/auth/reset/confirm') {
    const body = await readJson(req)
    const account = accounts.completeReset({ token: body.token, password: body.password })
    // ここで新しいトークンを出す。再設定したのにログインし直させる理由がない
    const token = accounts.issueToken(account)
    send(res, 200, { account, ...token })
    return
  }

  if (req.method === 'POST' && p === '/api/auth/password') {
    const me = accounts.authenticate(req)
    const body = await readJson(req)
    const account = accounts.changePassword({
      handle: me.handle,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      clientKey: key,
    })
    // 世代が進んで手元のトークンは無効になったので、新しいものを渡す
    const token = accounts.issueToken(account)
    send(res, 200, { account, ...token })
    return
  }

  if (req.method === 'POST' && p === '/api/auth/contact') {
    const me = accounts.authenticate(req)
    const body = await readJson(req)
    const { account } = accounts.setContact({
      handle: me.handle,
      password: body.password,
      contact: body.contact,
      clientKey: key,
    })
    send(res, 200, { account })
    return
  }

  if (req.method === 'DELETE' && p === '/api/auth/me') {
    const me = accounts.authenticate(req)
    const body = await readJson(req)
    // パスワード再入力を必須にする（auth.mjs 参照）。Story も一緒に消す —
    // 記録は本人のもので、退会後にハンドルだけ残った Story は誰のものでもなくなる。
    accounts.deleteAccount({ handle: me.handle, password: body.password })
    const removed = stories.removeByAuthor(me.id)
    images.removeByAuthor(me.id)
    send(res, 200, { ok: true, removedStories: removed })
    return
  }

  // ---- Story ----
  if (req.method === 'GET' && p === '/api/stories.json') {
    send(res, 200, stories.listPublic({
      page: url.searchParams.get('page') ?? 1,
      tool: url.searchParams.get('tool') ?? '',
      topic: url.searchParams.get('topic') ?? '',
    }))
    return
  }

  if (req.method === 'POST' && p === '/api/stories') {
    const me = accounts.authenticate(req)
    const body = await readJson(req)
    const { image } = resolveImage(body.imageId, me, null)
    const record = stories.create(me, body, { image: image ?? null })
    if (image) images.attach(image.id, { authorId: me.id, storyId: record.id })
    send(res, 201, { story: publicStory(record) })
    return
  }

  const storyJson = /^\/api\/stories\/([A-Za-z0-9_-]{8})\.json$/.exec(p)
  if (req.method === 'GET' && storyJson) {
    const record = stories.get(storyJson[1])
    if (!record) throw new StoryError('Story が見つかりません。', 404)
    if (record.status !== 'public') {
      // 下書きは本人だけ。存在も明かさない（404 に揃える）
      const me = maybeAccount(req)
      if (!me || me.id !== record.authorId) {
        throw new StoryError('Story が見つかりません。', 404)
      }
    }
    send(res, 200, { story: publicStory(record) })
    return
  }

  const storyPath = /^\/api\/stories\/([A-Za-z0-9_-]{8})$/.exec(p)
  if (storyPath && (req.method === 'PUT' || req.method === 'DELETE')) {
    const me = accounts.authenticate(req)
    if (req.method === 'PUT') {
      const body = await readJson(req)
      const current = stories.get(storyPath[1])
      const { image, removed } = resolveImage(
        body.imageId,
        me,
        current?.authorId === me.id ? current.image : null,
      )
      const record = stories.update(storyPath[1], me, body, { image })
      if (image?.id) images.attach(image.id, { authorId: me.id, storyId: record.id })
      // 差し替え・取り外しで使われなくなった画像は消す（残すと誰のものでも
      // ない実体がディスクに積もる）
      if (removed && removed !== image?.id) images.remove(removed)
      send(res, 200, { story: publicStory(record) })
    } else {
      const record = stories.remove(storyPath[1], me)
      if (record.image?.id) images.remove(record.image.id)
      send(res, 200, { ok: true })
    }
    return
  }

  if (req.method === 'GET' && p === '/api/mine') {
    const me = accounts.authenticate(req)
    const mine = stories.listByAuthor(me.id).map(publicStory)
    send(res, 200, {
      stories: mine,
      total: mine.length,
      limit: STORY_LIMITS.maxPerAuthor,
    })
    return
  }

  const creatorPath = /^\/api\/creators\/([a-z0-9][a-z0-9_-]{2,31})\.json$/.exec(p)
  if (req.method === 'GET' && creatorPath) {
    const handle = creatorPath[1]
    if (!HANDLE_RE.test(handle)) throw new StoryError('書き手が見つかりません。', 404)
    const listing = stories.listPublic({
      page: url.searchParams.get('page') ?? 1,
      handle,
    })
    // 書き手の実在は Story の有無で判定する。アカウントの存在は明かさない
    // （ハンドルの総当たり調査に使われるため。Story が 0 件の実在アカウントは
    // 「まだ何も書いていない人」として同じ見た目になる）。
    send(res, 200, { handle, ...listing })
    return
  }

  // ---- RSS ----
  // CY_SITE_ORIGIN が無ければ配らない。嘘の絶対 URL を購読者の手元に残さない。
  if (req.method === 'GET' && p.startsWith('/api/feeds/')) {
    if (!siteOrigin()) {
      send(res, 503, { error: 'フィードは準備中です。' })
      return
    }
    const sendFeed = (xml) => sendRaw(res, 200, xml, 'application/rss+xml; charset=utf-8')

    if (p === '/api/feeds/stories.xml') {
      sendFeed(
        buildStoriesFeed({
          title: 'CreatorYard — 新着の制作記録',
          link: `${siteOrigin()}/stories/`,
          description: 'ゲームを作る人の制作記録（Creator Story）の新着。',
          stories: stories.latestPublic({ limit: 30 }),
        }),
      )
      return
    }
    const byAuthor = /^\/api\/feeds\/creators\/([a-z0-9][a-z0-9_-]{2,31})\.xml$/.exec(p)
    if (byAuthor) {
      const handle = byAuthor[1]
      sendFeed(
        buildStoriesFeed({
          title: `${handle} の制作記録 — CreatorYard`,
          link: `${siteOrigin()}/creators/${handle}/`,
          description: `${handle} の Creator Story の新着。`,
          stories: stories.latestPublic({ limit: 30, handle }),
        }),
      )
      return
    }
  }

  if (req.method === 'GET' && p === '/api/tags.json') {
    send(res, 200, stories.tagIndex())
    return
  }

  // ---- 画像 ----
  if (req.method === 'POST' && p === '/api/story-image') {
    const me = accounts.authenticate(req)
    // 上限＋1 バイトまで読む。ぴったりで切ると「上限ちょうど」の正当な
    // 画像まで壊れて届く
    const buf = await readRaw(req, IMAGE_LIMITS.maxBytes + 1)
    const meta = images.save(buf, {
      authorId: me.id,
      filename: String(req.headers['x-filename'] ?? ''),
    })
    send(res, 201, {
      image: { id: meta.id, ext: meta.ext, width: meta.width, height: meta.height },
      warnings: meta.warnings,
    })
    return
  }

  const imagePath = /^\/api\/images\/([A-Za-z0-9_-]{16})\.(png|jpg|webp)$/.exec(p)
  if (req.method === 'GET' && imagePath) {
    const found = images.filePath(imagePath[1], imagePath[2])
    if (!found) throw new ImageError('画像が見つかりません。', 404)
    // ID は乱数で、中身が変わることはない（差し替えは別 ID になる）ので
    // 長期キャッシュしてよい。nosniff は「画像として検査したものを画像と
    // してだけ解釈させる」ための最後の砦
    res.writeHead(200, {
      'content-type': found.mime,
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-disposition': 'inline',
    })
    fs.createReadStream(found.file).pipe(res)
    return
  }

  // ---- 通報 ----
  if (req.method === 'POST' && p === '/api/reports') {
    const body = await readJson(req)
    const { ticket } = reports.create({
      target: body.target,
      category: body.category,
      detail: body.detail,
      contact: body.contact,
    })
    send(res, 201, {
      ticket,
      // 受付番号を「連絡の際に伝えてください」と促す 1 文を削った
      // （I-10 の言い残し）。確認画面からは 2026-08-17 に消したが、
      // ここには残っていた。画面は
      // この message を使わず ticket だけを読むので目には触れないが、
      // **返した時点で約束は約束である**（通報は認証不要＝誰でも叩ける）。
      // 連絡先（CY_CONTACT_EMAIL）が決まるまで、伝える先は無い。
      message: `受け付けました。受付番号は ${ticket} です。運営が内容を確認します。`,
    })
    return
  }

  if (req.method === 'GET' && p === '/api/reports') {
    requireAdmin(req)
    send(res, 200, {
      reports: reports.list({ status: url.searchParams.get('status') ?? '' }),
      categories: REPORT_CATEGORIES,
      statuses: REPORT_STATUSES,
    })
    return
  }

  const reportPath = /^\/api\/reports\/([0-9a-f-]{36})$/.exec(p)
  if (req.method === 'POST' && reportPath) {
    requireAdmin(req)
    const body = await readJson(req)
    send(res, 200, { report: reports.update(reportPath[1], { status: body.status, note: body.note }) })
    return
  }

  // ---- sitemap ----
  // 公開 Story と書き手ページの sitemap。静的側の sitemap とは別系列
  // （GAMEYARD の /sitemap-uploads.xml と同じ分け方）。nginx がこのパスを
  // API へ回す。sitemap の URL は絶対でなければならないので、公開オリジン
  // （CY_SITE_ORIGIN）が決まるまでは出さない — 相対や仮のドメインで出すと、
  // 検索側に間違った URL を覚えさせることになる。
  if (req.method === 'GET' && p === '/sitemap-stories.xml') {
    const origin = (process.env.CY_SITE_ORIGIN ?? '').replace(/\/+$/, '')
    if (!/^https:\/\//.test(origin)) {
      send(res, 404, { error: 'CY_SITE_ORIGIN が未設定のため sitemap はまだ出せません。' })
      return
    }
    const index = stories.publicIndex()
    const handles = new Map()
    for (const s of index) {
      const last = handles.get(s.authorHandle)
      if (!last || s.updatedAt > last) handles.set(s.authorHandle, s.updatedAt)
    }
    const urls = [
      ...index.map(
        (s) =>
          `<url><loc>${origin}/story/${s.id}/</loc><lastmod>${s.updatedAt.slice(0, 10)}</lastmod></url>`,
      ),
      ...[...handles.entries()].map(
        ([handle, last]) =>
          `<url><loc>${origin}/creators/${handle}/</loc><lastmod>${last.slice(0, 10)}</lastmod></url>`,
      ),
    ]
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.join('\n') +
      '\n</urlset>\n'
    res.writeHead(200, {
      'content-type': 'application/xml; charset=utf-8',
      'x-content-type-options': 'nosniff',
      // 作者による削除・非公開化を次の取得へ即時反映する。初期規模では
      // sitemap のキャッシュ効率より、公開解除の予測可能性を優先する。
      'cache-control': 'no-store',
    })
    res.end(xml)
    return
  }

  send(res, 404, { error: '見つかりません。' })
}

const server = http.createServer((req, res) => {
  try {
    if (applyCors(req, res)) return
    handle(req, res).catch((err) => sendError(res, err))
  } catch (err) {
    sendError(res, err)
  }
})

// テストから import したときは起動しない（ポートを奪い合わない）
if (process.env.CY_API_AUTOSTART !== '0') {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`creatoryard-api: http://127.0.0.1:${PORT} (data: ${DATA})`)
  })
}

export { server, accounts, stories, gate }

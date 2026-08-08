#!/usr/bin/env node
/**
 * 書く側の受付 API（CreatorYard）。
 *
 * GAMEYARD の server/api.mjs と同じ分離: 読む側は静的書き出しのままにし、
 * サーバーでしかできないこと（認証）だけをこの小さな単独サービスが受ける。
 * Next の Route Handler にしないのは、既定ビルドが output:'export' で
 * POST の Handler と衝突するため（designs.md 2026-08-08 16:22）。
 *
 *   GET  /api/health         死活（UI が事前に確認する）
 *   POST /api/auth/register  書き手アカウント作成（handle・password のみ）
 *   POST /api/auth/login     ログイン（Bearer トークンを返す）
 *   GET  /api/auth/me        トークンの確認
 *   POST /api/stories            Story 作成（要ログイン。既定は下書き）
 *   PUT  /api/stories/<id>       更新・公開/下書き切替（要ログイン・本人のみ）
 *   GET  /api/stories.json       公開 Story の一覧（新着順・?page=）
 *   GET  /api/stories/<id>.json  Story 1 件（下書きは本人のみ。他人には 404）
 *   GET  /api/mine/stories       自分の Story（下書き含む。要ログイン）
 *
 * 認証は Authorization: Bearer。cookie を使わないので、ブラウザの自動送信を
 * 突く形の CSRF はここでは成立しない。
 */
import http from 'node:http'
import path from 'node:path'

import { Accounts, AuthError } from './lib/auth.mjs'
import { Stories, StoryError } from './lib/stories.mjs'

/** JSON body の上限。認証系の入力に 8KB を超える正当な理由はない。 */
const MAX_BODY_BYTES = 8 * 1024

/**
 * CORS。本体（静的配信）と API が別オリジンになる構成のため必要
 * （GAMEYARD と同型。トークンを localStorage に置くのも同じ理由）。
 * 本番でオリジンを固定するのは WRITE_API_ORIGIN の設定＝運用の仕事。
 * cookie を使わない（credentials なし）ので '*' でも露出は流用元と同水準。
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.WRITE_API_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] ?? '')
    if (!type.startsWith('application/json')) {
      reject(new AuthError('Content-Type は application/json にしてください。', 415))
      return
    }
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new AuthError('リクエストが大きすぎます。', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new AuthError('JSON を解釈できません。', 400))
      }
    })
    req.on('error', () => reject(new AuthError('読み取りに失敗しました。', 400)))
  })
}

export function createApiServer({ dir, now } = {}) {
  const usersDir = dir ?? path.join(process.cwd(), 'data', 'users')
  const accounts = new Accounts({ dir: usersDir, ...(now ? { now } : {}) })
  // stories は users の隣（data/stories）。試験でも同じ相対関係になる
  const stories = new Stories({
    dir: path.join(path.dirname(usersDir), 'stories'),
    ...(now ? { now } : {}),
  })

  /** Bearer の確認。無ければ 401。 */
  const authenticate = (req) => {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')
    if (!match) throw new AuthError('この操作にはログインが必要です。')
    return accounts.verifyToken(match[1].trim())
  }

  /** ログインしていれば本人、していなければ null（公開分だけ見える）。 */
  const viewerOf = (req) => {
    if (!req.headers.authorization) return null
    try {
      return authenticate(req)
    } catch {
      return null
    }
  }

  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        ...CORS_HEADERS,
      })
      res.end(JSON.stringify(body))
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS)
      res.end()
      return
    }

    const route = `${req.method} ${new URL(req.url, 'http://local').pathname}`
    try {
      if (route === 'GET /api/health') {
        send(200, { ok: true })
        return
      }
      if (route === 'POST /api/auth/register') {
        const body = await readJsonBody(req)
        const account = accounts.register({ handle: body.handle, password: body.password })
        const token = accounts.issueToken(account)
        send(201, { account, ...token })
        return
      }
      if (route === 'POST /api/auth/login') {
        const body = await readJsonBody(req)
        const account = accounts.login({
          handle: body.handle,
          password: body.password,
          // バックオフの単位はソケットの相手アドレス。個人の行動計測ではなく
          // 総当たりを鈍らせるためだけに使い、保存もしない
          clientKey: req.socket.remoteAddress ?? 'unknown',
        })
        const token = accounts.issueToken(account)
        send(200, { account, ...token })
        return
      }
      if (route === 'GET /api/auth/me') {
        send(200, { account: authenticate(req) })
        return
      }
      if (route === 'POST /api/stories') {
        const account = authenticate(req)
        const body = await readJsonBody(req)
        send(201, { story: stories.create({ author: account, input: body }) })
        return
      }
      const putStory = /^PUT \/api\/stories\/([a-f0-9]{16})$/.exec(route)
      if (putStory) {
        const account = authenticate(req)
        const body = await readJsonBody(req)
        send(200, { story: stories.update({ id: putStory[1], authorId: account.id, input: body }) })
        return
      }
      if (route === 'GET /api/stories.json') {
        const params = new URL(req.url, 'http://local').searchParams
        const page = Number(params.get('page') ?? 1)
        const author = params.get('author')
        // 絞り込みはハンドル形式だけ受ける。自由文字列を store まで通さない
        if (author !== null && !/^[a-z0-9][a-z0-9_-]{2,31}$/.test(author)) {
          send(400, { error: 'author の形式が不正です。' })
          return
        }
        send(200, stories.listPublic({ page: Number.isFinite(page) ? page : 1, author }))
        return
      }
      const getStory = /^GET \/api\/stories\/([a-f0-9]{16})\.json$/.exec(route)
      if (getStory) {
        const story = stories.getVisible(getStory[1], viewerOf(req)?.id ?? null)
        if (!story) {
          send(404, { error: 'Story が見つかりません。' })
          return
        }
        send(200, { story })
        return
      }
      if (route === 'GET /api/mine/stories') {
        const account = authenticate(req)
        send(200, { stories: stories.listMine(account.id) })
        return
      }
      send(404, { error: '見つかりません。' })
    } catch (err) {
      if (err instanceof AuthError || err instanceof StoryError) {
        send(err.status, { error: err.message })
        return
      }
      // 詳細を外に出さない。中身はログにだけ残す
      console.error(err)
      send(500, { error: 'サーバー内部で問題が起きました。' })
    }
  })
}

// テストからは createApiServer を使う。直接起動されたときだけ listen する。
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3010)
  createApiServer({}).listen(port, () => {
    console.log(`CreatorYard api: http://localhost:${port}/api/health`)
  })
}

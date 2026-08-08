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
 *
 * 認証は Authorization: Bearer。cookie を使わないので、ブラウザの自動送信を
 * 突く形の CSRF はここでは成立しない。
 */
import http from 'node:http'
import path from 'node:path'

import { Accounts, AuthError } from './lib/auth.mjs'

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
  const accounts = new Accounts({
    dir: dir ?? path.join(process.cwd(), 'data', 'users'),
    ...(now ? { now } : {}),
  })

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
        const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')
        if (!match) throw new AuthError('この操作にはログインが必要です。')
        send(200, { account: accounts.verifyToken(match[1].trim()) })
        return
      }
      send(404, { error: '見つかりません。' })
    } catch (err) {
      if (err instanceof AuthError) {
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

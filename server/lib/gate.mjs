/**
 * API の流量制御。GAMEYARD（server/lib/limits-gate.mjs）の縮約版。
 *
 * CreatorYard にはウイルス検査のような重い経路がまだ無いので、同時実行の
 * 制御は持ってこず、送信元ごとの割当だけを移植した。それでも割当を持つのは
 * GAMEYARD で確立した理由と同じ — 無制限に受けると、書き込みでディスクを、
 * 読み出しでファイル走査を、それぞれ回し続けられる。
 *
 * バケツは 2 つに分ける（GAMEYARD の教訓）。使い回すと、一覧を数回開いた
 * だけで投稿の割当を食い潰し、正当な書き手が投稿できなくなる。
 *
 *   - write: 登録・ログイン・Story の作成/更新/削除。1 回が重く、回数は少ない
 *   - read:  一覧・個人ページ・タグ索引。1 回が安く、画面遷移のたびに呼ばれる
 *
 * 状態はプロセス内のメモリに持つ。複数台構成にするときは共有ストアへ
 * 移すこと（プロセスごとに別勘定になり制限が緩むため）。
 */

export const GATE_DEFAULTS = {
  /**
   * 書き込みの割当（トークンバケット）。
   * 入力の不備でやり直す往復も消費するので、数回では正当な書き手が止まる。
   * GAMEYARD の投稿枠（6/12）より緩いのは、Story はテキストだけで
   * 1 回が安く、下書き保存を繰り返す使い方を見込むため。
   */
  perIpWriteBurst: 20,
  perIpWriteRefillPerMinute: 30,

  /** 読み出しの割当。書き込みとは別に数える。 */
  perIpReadBurst: 60,
  perIpReadRefillPerMinute: 120,

  /** 状態を保持する送信元の上限。ここも無制限だとメモリを食われる。 */
  maxTrackedClients: 10_000,
  /** この時間見なかった送信元は忘れてよい */
  idleForgetMs: 60 * 60 * 1000,
}

export class RateLimitError extends Error {
  constructor(message, retryAfterSec) {
    super(message)
    this.name = 'RateLimitError'
    this.status = 429
    this.retryAfterSec = retryAfterSec
  }
}

/**
 * 送信元の識別。
 *
 * X-Forwarded-For を無条件に信用すると、ヘッダを偽装するだけで制限を
 * すり抜けられる。信頼するプロキシを明示的に設定したときだけ参照し、
 * 既定ではソケットの接続元だけを見る。
 */
export function clientKey(req, { trustProxy = false } = {}) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for']
    if (typeof xff === 'string' && xff.length) {
      // 最も左が原始のクライアント。ただし信頼できるプロキシ配下である前提。
      const first = xff.split(',')[0].trim()
      if (first) return first
    }
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

export class Gate {
  constructor(options = {}) {
    this.opts = { ...GATE_DEFAULTS, ...options }
    this.clients = new Map()
    this.stats = { accepted: 0, rateLimited: 0 }
  }

  /** 古い記録を捨てる。放置すると送信元ごとの状態が無限に増える。 */
  #prune(now) {
    if (this.clients.size <= this.opts.maxTrackedClients) return
    for (const [key, state] of this.clients) {
      if (now - state.lastSeen > this.opts.idleForgetMs) this.clients.delete(key)
      if (this.clients.size <= this.opts.maxTrackedClients * 0.9) break
    }
  }

  #state(key, now) {
    let state = this.clients.get(key)
    if (!state) {
      state = {
        writeTokens: this.opts.perIpWriteBurst,
        writeRefill: now,
        readTokens: this.opts.perIpReadBurst,
        readRefill: now,
        lastSeen: now,
      }
      this.clients.set(key, state)
      this.#prune(now)
    }
    state.lastSeen = now
    return state
  }

  #consume(state, tokensKey, refillKey, burst, refillPerMinute, now) {
    const elapsedMin = (now - state[refillKey]) / 60_000
    if (elapsedMin > 0) {
      state[tokensKey] = Math.min(burst, state[tokensKey] + elapsedMin * refillPerMinute)
      state[refillKey] = now
    }
    if (state[tokensKey] < 1) {
      this.stats.rateLimited += 1
      const waitSec = Math.ceil(((1 - state[tokensKey]) / refillPerMinute) * 60)
      throw new RateLimitError(
        `リクエストが続いたため一時的に受け付けていません。${waitSec} 秒後にお試しください。`,
        waitSec,
      )
    }
    state[tokensKey] -= 1
    this.stats.accepted += 1
  }

  /** 書き込み経路の割当を消費する。超過なら RateLimitError。 */
  consumeWrite(key, now = Date.now()) {
    const state = this.#state(key, now)
    this.#consume(
      state, 'writeTokens', 'writeRefill',
      this.opts.perIpWriteBurst, this.opts.perIpWriteRefillPerMinute, now,
    )
  }

  /** 読み出し経路の割当を消費する。書き込みの枠には触らない。 */
  consumeRead(key, now = Date.now()) {
    const state = this.#state(key, now)
    this.#consume(
      state, 'readTokens', 'readRefill',
      this.opts.perIpReadBurst, this.opts.perIpReadRefillPerMinute, now,
    )
  }
}

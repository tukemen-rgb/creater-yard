/**
 * 書き手アカウント（CreatorYard）。
 *
 * GAMEYARD（tukemen-rgb/site の server/lib/auth.mjs）からの移植。目的は
 * 「誰が書いたか」を持つこと、その一点。決まりは流用元のまま:
 * パスワードは scrypt で保存する（SHA-256 系の単純ハッシュは GPU で
 * 総当たりされるため、鍵導出関数でなければ意味がない。Node 標準に
 * 入っているので依存を増やさずに済む）。セッションは HMAC 署名トークン。
 *
 * 流用元から意図して落としたもの（後の段階で流用元から戻す）:
 *   - パスワード再設定・連絡先（メール）変更・退会と墓標。メール送信手段が
 *     まだ無く、SPEC どおり登録はハンドル＋パスワードの 2 項目だけ。
 *     メール欄は設定画面の実装時に「用途はパスワード再設定のみ」と明記して足す
 *   - メールアドレス以外の自由記述の連絡先。CreatorYard では最初から
 *     持たない（用途をパスワード再設定だけに絞るため）
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/** scrypt のコスト。N=16384 で 1 回あたり数十 ms。総当たりを鈍くする。 */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }
const TOKEN_TTL_SEC = 30 * 24 * 60 * 60
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/
const MIN_PASSWORD = 10
const MAX_PASSWORD = 200
/** ログイン失敗の追跡数。無制限に持つとメモリを攻撃面にされる。 */
const MAX_TRACKED_FAILURES = 10_000

function b64u(buf) {
  return Buffer.from(buf).toString('base64url')
}

function hashPassword(password, salt = crypto.randomBytes(32)) {
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    // 既定の maxmem では N=16384 が通らない環境があるため明示する
    maxmem: 64 * 1024 * 1024,
  })
  return { salt: salt.toString('base64'), hash: key.toString('base64'), kdf: 'scrypt', ...SCRYPT }
}

function verifyPassword(password, record) {
  const salt = Buffer.from(record.salt, 'base64')
  const expected = Buffer.from(record.hash, 'base64')
  const actual = crypto.scryptSync(password, salt, expected.length, {
    N: record.N ?? SCRYPT.N,
    r: record.r ?? SCRYPT.r,
    p: record.p ?? SCRYPT.p,
    maxmem: 64 * 1024 * 1024,
  })
  // 長さが違うと timingSafeEqual が例外を投げるので先に揃えて確認する
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

/**
 * 署名鍵の取得。
 *
 * 環境変数がなければファイルに作る。プロセス内で生成して捨てると
 * 再起動のたびに全員がログアウトし、「なぜか勝手に切れる」という
 * 追いにくい不具合になる。ファイルは 0600 で置く。
 */
function loadSecret(dir) {
  const fromEnv = process.env.AUTH_SECRET
  if (fromEnv && fromEnv.length >= 32) return Buffer.from(fromEnv, 'utf8')
  if (fromEnv) {
    throw new Error('AUTH_SECRET は 32 文字以上にしてください（短い鍵は署名偽造の余地を残します）')
  }

  const file = path.join(dir, '.auth-secret')
  if (fs.existsSync(file)) return fs.readFileSync(file)
  const secret = crypto.randomBytes(48)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, secret, { mode: 0o600 })
  return secret
}

export class Accounts {
  #dir
  #secret
  #failures = new Map()

  constructor({ dir, now = () => Date.now() }) {
    this.#dir = dir
    this.now = now
    fs.mkdirSync(dir, { recursive: true })
    this.#secret = loadSecret(path.dirname(dir))
    this.secretFromEnv = Boolean(process.env.AUTH_SECRET)
  }

  #file(handle) {
    // handle は HANDLE_RE を通ったものだけを渡す。ここでパス操作は起きない。
    return path.join(this.#dir, `${handle}.json`)
  }

  #read(handle) {
    try {
      return JSON.parse(fs.readFileSync(this.#file(handle), 'utf8'))
    } catch {
      return null
    }
  }

  /** 失敗回数に応じてログインを一時的に締める。締める時間は指数的に伸ばす。 */
  #lockRemaining(key) {
    const entry = this.#failures.get(key)
    if (!entry) return 0
    const remaining = entry.until - this.now()
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0
  }

  #recordFailure(key) {
    if (this.#failures.size > MAX_TRACKED_FAILURES) {
      // 古い順に落とす。追跡そのものが資源になるため上限を持つ。
      const oldest = [...this.#failures.entries()].sort((a, b) => a[1].until - b[1].until)
      for (const [k] of oldest.slice(0, Math.floor(MAX_TRACKED_FAILURES / 10))) {
        this.#failures.delete(k)
      }
    }
    const entry = this.#failures.get(key) ?? { count: 0, until: 0 }
    entry.count += 1
    if (entry.count >= 5) {
      const backoffSec = Math.min(30 * 2 ** (entry.count - 5), 30 * 60)
      entry.until = this.now() + backoffSec * 1000
    }
    this.#failures.set(key, entry)
  }

  #clearFailures(...keys) {
    for (const key of keys) this.#failures.delete(key)
  }

  static validateHandle(handle) {
    if (typeof handle !== 'string' || !HANDLE_RE.test(handle)) {
      throw new AuthError(
        'ハンドルは英小文字・数字・ハイフン・アンダースコアの3〜32文字にしてください。',
        400,
      )
    }
  }

  static validatePassword(password) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
      throw new AuthError(`パスワードは${MIN_PASSWORD}文字以上にしてください。`, 400)
    }
    if (password.length > MAX_PASSWORD) {
      throw new AuthError(`パスワードは${MAX_PASSWORD}文字以内にしてください。`, 400)
    }
  }

  register({ handle, password }) {
    Accounts.validateHandle(handle)
    Accounts.validatePassword(password)
    if (this.#read(handle)) {
      throw new AuthError('このハンドルは既に使われています。', 409)
    }
    const account = {
      id: crypto.randomUUID(),
      handle,
      // 登録時は常に空。設定画面の実装時に「パスワード再設定のみに使う」
      // と明記して任意登録にする（proposals 2026-08-08 15:12）
      email: '',
      createdAt: new Date(this.now()).toISOString(),
      password: hashPassword(password),
      // トークンの世代。パスワードを変えるたびに 1 増え、古い世代の
      // トークンは無効になる。時刻ではなく数え上げにしているのは、
      // 時刻だと「発行と変更が同じ時刻に入った場合」に古いトークンが
      // 生き残るため（秒でもミリ秒でも、粒度がある限り同じ穴が残る）。
      tokenEpoch: 1,
    }
    // 既に居るハンドルを後から上書きしないよう、排他作成で書く。
    fs.writeFileSync(this.#file(handle), JSON.stringify(account, null, 2), {
      flag: 'wx',
      mode: 0o600,
    })
    return this.#publicAccount(account)
  }

  login({ handle, password, clientKey = 'unknown' }) {
    const handleKey = `h:${handle}`
    const ipKey = `i:${clientKey}`
    const locked = Math.max(this.#lockRemaining(handleKey), this.#lockRemaining(ipKey))
    if (locked > 0) {
      throw new AuthError(
        `ログインの試行が続いたため一時的に受け付けていません。${locked} 秒後にお試しください。`,
        429,
      )
    }

    const account = typeof handle === 'string' && HANDLE_RE.test(handle) ? this.#read(handle) : null
    // 存在しないハンドルでも同じ経路・同じ文言を返す。ここで区別すると
    // 「どのハンドルが存在するか」を総当たりで調べられてしまう。
    const ok = account ? verifyPassword(password ?? '', account.password) : false
    if (!ok) {
      this.#recordFailure(handleKey)
      this.#recordFailure(ipKey)
      throw new AuthError('ハンドルまたはパスワードが違います。', 401)
    }
    this.#clearFailures(handleKey, ipKey)
    return this.#publicAccount(account)
  }

  #publicAccount(account) {
    return {
      id: account.id,
      handle: account.handle,
      createdAt: account.createdAt,
    }
  }

  issueToken(account, ttlSec = TOKEN_TTL_SEC) {
    const payload = {
      sub: account.id,
      handle: account.handle,
      // 発行時点の世代を埋め込む。確認時に現在の世代と一致しなければ拒否する。
      epoch: Number(this.#read(account.handle)?.tokenEpoch ?? 0),
      iat: Math.floor(this.now() / 1000),
      exp: Math.floor(this.now() / 1000) + ttlSec,
    }
    const body = b64u(JSON.stringify(payload))
    const sig = b64u(crypto.createHmac('sha256', this.#secret).update(body).digest())
    return { token: `v1.${body}.${sig}`, expiresAt: new Date(payload.exp * 1000).toISOString() }
  }

  /** 署名 → 期限 → 実在の順に確認する。どれか 1 つでも欠ければ拒否。 */
  verifyToken(token) {
    if (typeof token !== 'string') throw new AuthError('認証が必要です。')
    const [version, body, sig] = token.split('.')
    if (version !== 'v1' || !body || !sig) throw new AuthError('認証情報の形式が不正です。')

    const expected = crypto.createHmac('sha256', this.#secret).update(body).digest()
    const given = Buffer.from(sig, 'base64url')
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      throw new AuthError('認証情報の署名が確認できません。')
    }

    let payload
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    } catch {
      throw new AuthError('認証情報を解釈できません。')
    }
    if (!payload.exp || payload.exp * 1000 < this.now()) {
      throw new AuthError('ログインの有効期限が切れています。再度ログインしてください。')
    }

    const account = typeof payload.handle === 'string' && HANDLE_RE.test(payload.handle)
      ? this.#read(payload.handle)
      : null
    // 署名が通っても、アカウントが消えていれば無効。削除済みアカウントの
    // トークンが有効期限まで生き続けるのを防ぐ。
    if (!account || account.id !== payload.sub) {
      throw new AuthError('アカウントが見つかりません。')
    }
    // 世代が違えばパスワードが変わっている。盗まれたトークンが変更後も
    // 期限まで生き続けるのを防ぐ。
    if (Number(payload.epoch ?? 0) !== Number(account.tokenEpoch ?? 0)) {
      throw new AuthError('パスワードが変更されたため、再度ログインしてください。')
    }
    return this.#publicAccount(account)
  }
}

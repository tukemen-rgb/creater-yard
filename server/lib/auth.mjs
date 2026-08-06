/**
 * 書き手アカウント。GAMEYARD（tukemen-rgb/site server/lib/auth.mjs）の
 * 自前認証をほぼそのまま流用する（HANDOVER.md §5 の決定）。
 *
 * 目的は「誰が書いたか」を持つこと、その一点に絞っている。Story は
 * 本人のもの（消す自由・退会したら消える）なので、所有者が確かめられる
 * ことが機能の前提になる。
 *
 * パスワードは scrypt で保存する。SHA-256 系の単純ハッシュは GPU で
 * 総当たりされるため、鍵導出関数でなければ意味がない。Node 標準に
 * 入っているので依存を増やさずに済む。
 *
 * パスワード再設定も GAMEYARD 版のまま。再設定トークンは平文で保存せず
 * SHA-256 だけを置く（store/ が読まれてもそこから再設定できないように）。
 * メール送信の設定（SMTP）が無い環境では、API が「使えない」と明示する
 * （mailer.mjs 参照。届かないメールを待たせるよりましなので隠さない）。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { isMailAddress } from './mailer.mjs'

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

/**
 * 再設定トークンの寿命。
 * 短くしたいが、メールが遅れる環境もあるので 30 分にした。長くすると、
 * 受信箱に残ったリンクが後から使える時間が伸びる。
 */
const RESET_TTL_SEC = 30 * 60
/**
 * 同じハンドルへの再設定要求の間隔。
 * 制限しないと、他人のハンドルを指定して受信箱を埋められる（本人以外でも
 * 要求は出せるため）。
 */
const RESET_MIN_INTERVAL_SEC = 60

export { isMailAddress }

/**
 * 連絡先を伏せた形にする。
 *
 * 本人が「どの宛先を登録しているか」を思い出せる程度に出し、宛先そのものは
 * 出さない。メールアドレス以外の連絡先（自由記述）は形が定まらないので、
 * 中身は一切出さずに「設定済み」とだけ返す。
 */
export function maskContact(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (!isMailAddress(raw)) return '（メール以外の連絡先が設定されています）'
  const at = raw.lastIndexOf('@')
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  const head = local.slice(0, 1)
  return `${head}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`
}

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

  /**
   * 連絡先の検査。
   *
   * 空でもよい（メールは任意 — SPEC §1）。ただしメールアドレスとして
   * 書かれているのに壊れている場合は断る。壊れた宛先を保存すると、
   * 将来メールを設置して再設定を要求しても届かず、しかも「届かない理由」を
   * 本人には知らせられない。登録時なら安全に言える。
   */
  static validateContact(contact) {
    const value = String(contact ?? '').trim()
    if (!value) return ''
    if (value.length > 200) {
      throw new AuthError('連絡先は200文字以内にしてください。', 400)
    }
    if (value.includes('@') && !isMailAddress(value)) {
      throw new AuthError(
        'メールアドレスの形式が正しくありません。受け取れるアドレスを入れてください。',
        400,
      )
    }
    return value
  }

  #tombstone(handle) {
    return path.join(this.#dir, `${handle}.deleted.json`)
  }

  #write(handle, account) {
    const file = this.#file(handle)
    const tmp = `${file}.tmp`
    // 書き途中で落ちるとアカウントが読めなくなる（= ログインできなくなる）。
    // 別名に書いてから置き換える。
    fs.writeFileSync(tmp, JSON.stringify(account, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  register({ handle, password, contact = '' }) {
    Accounts.validateHandle(handle)
    Accounts.validatePassword(password)
    if (this.#read(handle)) {
      throw new AuthError('このハンドルは既に使われています。', 409)
    }
    // 退会直後のハンドルは一定期間再利用させない。
    // すぐ取れると、退会した書き手の名前で別人が Story を書けてしまう
    // （Story には書き手のハンドルが出るため、なりすましになる）。
    try {
      const tomb = JSON.parse(fs.readFileSync(this.#tombstone(handle), 'utf8'))
      const until = new Date(tomb.reservedUntil).getTime()
      if (Number.isFinite(until) && until > this.now()) {
        const days = Math.ceil((until - this.now()) / 86400000)
        throw new AuthError(
          `このハンドルは以前使われていたため、あと ${days} 日は登録できません。`,
          409,
        )
      }
    } catch (err) {
      if (err instanceof AuthError) throw err
      // 墓標が無い / 読めないのは通常のケース
    }
    const account = {
      id: crypto.randomUUID(),
      handle,
      contact: Accounts.validateContact(contact),
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

  /**
   * パスワード再設定の要求（GAMEYARD 版のまま）。
   *
   * 返り値で「送るべきか」を呼び出し側に伝えるが、呼び出し側は結果に
   * かかわらず同じ応答を返す約束になっている。ここで「そのハンドルは
   * ありません」と言うと、ハンドルの実在を総当たりで調べられる。
   *
   * トークンは平文で保存しない。保存するのは SHA-256 だけにして、
   * store/ が読まれてもそこから再設定できないようにする。パスワード
   * ハッシュに scrypt を使っているのに、再設定トークンが平文で置いて
   * あれば、そちらが最も弱い場所になる。
   */
  requestReset({ handle }) {
    if (typeof handle !== 'string' || !HANDLE_RE.test(handle)) return null
    const account = this.#read(handle)
    if (!account) return null
    // 宛先が無い / メールアドレスでないアカウントは再設定できない。
    if (!isMailAddress(account.contact)) return null

    const now = this.now()
    const last = account.reset?.requestedAt ? Date.parse(account.reset.requestedAt) : 0
    if (Number.isFinite(last) && now - last < RESET_MIN_INTERVAL_SEC * 1000) {
      // 直前に出したものが生きているので、新しくは出さない。
      // 呼び出し側から見れば「送らない」だけで、応答は変わらない。
      return null
    }

    const secret = crypto.randomBytes(32).toString('base64url')
    account.reset = {
      hash: crypto.createHash('sha256').update(secret).digest('base64'),
      requestedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + RESET_TTL_SEC * 1000).toISOString(),
    }
    this.#write(handle, account)
    // ハンドルを前置きしておくと、確認時に全アカウントを走査せずに引ける。
    // ハンドルは本人が知っている情報なので、これ自体は秘密ではない。
    return {
      token: `${handle}.${secret}`,
      contact: account.contact,
      expiresAt: account.reset.expiresAt,
      ttlMinutes: Math.round(RESET_TTL_SEC / 60),
    }
  }

  /**
   * 再設定の実行。
   *
   * トークンは 1 回だけ使える。使い終わったら消す。残すと、受信箱に
   * 残ったリンクで期限内に何度でも変えられる。
   */
  completeReset({ token, password }) {
    Accounts.validatePassword(password)
    const invalid = new AuthError(
      'この再設定リンクは使えません。期限が切れているか、すでに使われています。',
      400,
    )
    if (typeof token !== 'string') throw invalid
    const dot = token.indexOf('.')
    if (dot <= 0) throw invalid
    const handle = token.slice(0, dot)
    const secret = token.slice(dot + 1)
    if (!HANDLE_RE.test(handle) || !secret) throw invalid

    const account = this.#read(handle)
    if (!account?.reset?.hash) throw invalid
    if (Date.parse(account.reset.expiresAt) <= this.now()) {
      delete account.reset
      this.#write(handle, account)
      throw invalid
    }

    const expected = Buffer.from(account.reset.hash, 'base64')
    const actual = crypto.createHash('sha256').update(secret).digest()
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      throw invalid
    }

    this.#applyNewPassword(handle, account, password)
    return this.#publicAccount(account)
  }

  /** ログイン中の変更。現在のパスワードを必ず確認する。 */
  changePassword({ handle, currentPassword, newPassword, clientKey = 'change-password' }) {
    this.login({ handle, password: currentPassword, clientKey })
    Accounts.validatePassword(newPassword)
    const account = this.#read(handle)
    if (!account) throw new AuthError('アカウントが見つかりません。')
    if (verifyPassword(newPassword, account.password)) {
      throw new AuthError('いまと同じパスワードです。別のものにしてください。', 400)
    }
    this.#applyNewPassword(handle, account, newPassword)
    return this.#publicAccount(account)
  }

  /**
   * パスワードを差し替え、発行済みトークンをすべて切る。
   *
   * 切らないと、盗まれたトークンはパスワードを変えても期限まで生き続ける。
   * 「変えたから安全」と思っている本人の認識と実際がずれる。
   */
  #applyNewPassword(handle, account, password) {
    account.password = hashPassword(password)
    account.passwordChangedAt = new Date(this.now()).toISOString()
    account.tokenEpoch = Number(account.tokenEpoch ?? 0) + 1
    // 使い終わった（または要求中の）再設定トークンも消す。残すと、
    // パスワードを変えた後も受信箱のリンクで再び変えられる
    delete account.reset
    this.#write(handle, account)
    // 失敗回数も忘れる。本人が入れ直した直後に締め出さない。
    this.#clearFailures(`h:${handle}`)
  }

  /**
   * 退会。パスワードの再入力を必須にする。
   *
   * トークンだけで消せると、端末を一時的に触られただけで Story ごと
   * 失われる。Story の削除は呼び出し側（API）が行う。ここはアカウント
   * だけを消す。
   */
  deleteAccount({ handle, password, reserveDays = 180 }) {
    const account = this.login({ handle, password, clientKey: 'self-delete' })
    const record = this.#read(handle)
    fs.writeFileSync(
      this.#tombstone(handle),
      JSON.stringify({
        handle,
        deletedAt: new Date(this.now()).toISOString(),
        reservedUntil: new Date(this.now() + reserveDays * 86400000).toISOString(),
        // 監査のため作成日だけ残す。パスワードハッシュも連絡先も残さない。
        createdAt: record?.createdAt ?? null,
      }, null, 2),
    )
    fs.rmSync(this.#file(handle), { force: true })
    return account
  }

  /**
   * 連絡先の変更。
   *
   * パスワードの再入力を必須にする。トークンだけで変えられると、端末を
   * 一時的に触られただけで連絡先を差し替えられる（将来メールを設置した
   * ときに、再設定の宛先を奪う入口になる）。
   */
  setContact({ handle, password, contact, clientKey = 'set-contact' }) {
    this.login({ handle, password, clientKey })
    const value = Accounts.validateContact(contact)
    const account = this.#read(handle)
    if (!account) throw new AuthError('アカウントが見つかりません。')
    const previous = account.contact ?? ''
    account.contact = value
    account.contactChangedAt = new Date(this.now()).toISOString()
    this.#write(handle, account)
    return { account: this.#publicAccount(account), previous }
  }

  /**
   * 期限切れの墓標を消す。
   *
   * 墓標はハンドルの再登録を一定期間止めるためだけのもので、期限を過ぎた
   * ものは判定に使われない。放っておくと退会した数だけファイルが残る。
   *
   * @returns {number} 消した数
   */
  pruneTombstones(now = this.now()) {
    let removed = 0
    let names
    try {
      names = fs.readdirSync(this.#dir)
    } catch {
      return 0
    }
    for (const name of names) {
      if (!name.endsWith('.deleted.json')) continue
      const file = path.join(this.#dir, name)
      try {
        const until = Date.parse(JSON.parse(fs.readFileSync(file, 'utf8')).reservedUntil)
        // 読めない・期限が入っていないものは消さない（判断できないものを
        // 消すと、消してよかったのかを後から確かめられない）
        if (Number.isFinite(until) && until < now) {
          fs.rmSync(file, { force: true })
          removed += 1
        }
      } catch {
        /* 壊れた 1 件で全体を止めない */
      }
    }
    return removed
  }

  #publicAccount(account) {
    return {
      id: account.id,
      handle: account.handle,
      createdAt: account.createdAt,
      // 連絡先はそのまま返さない。伏せた形なら、本人が「どの宛先を登録して
      // いるか」を確かめるには足り、控えが残っても宛先そのものは漏れない。
      contact: maskContact(account.contact),
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
    // 署名が通っても、アカウントが消えていれば無効。退会済みアカウントの
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

  /** Authorization ヘッダから認証する。無ければ 401。 */
  authenticate(req) {
    const header = req.headers?.authorization ?? ''
    const match = /^Bearer\s+(.+)$/i.exec(header)
    if (!match) throw new AuthError('この操作にはログインが必要です。')
    return this.verifyToken(match[1].trim())
  }
}

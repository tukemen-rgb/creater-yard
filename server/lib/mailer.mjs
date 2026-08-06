/**
 * メール送信。
 *
 * パスワード再設定のためだけに使う。用途が 1 つなので、汎用のメール
 * ライブラリは入れず、SMTP を直接話す最小限の実装にしている。依存を
 * 増やさない理由はこのプロジェクトの他の部分と同じで、投稿を受け付ける
 * サーバーに入れる外部コードを減らしたいため。
 *
 * 送信手段は環境変数で選ぶ。業者を固定していないので、SMTP を話せる
 * ところならコードを変えずに使える。
 *
 *   MAIL_TRANSPORT=none      … 送信しない（既定）。再設定機能は無効になり、
 *                              「無効である」ことを API が明示する。
 *   MAIL_TRANSPORT=smtp      … SMTP_HOST へ直接送る
 *   MAIL_TRANSPORT=sendmail  … ローカルの sendmail 互換コマンドに渡す
 *
 * 実装していないふりをしないための既定値が none。設定されていないのに
 * 「送信しました」と返すと、届かないメールを待たせることになる。
 *
 * ここで特に気をつけていること:
 *
 *   1. ヘッダ差し込み。宛先は利用者が登録した文字列なので、改行が
 *      混じると Bcc: を足して任意の宛先へ送らせられる。アドレスは
 *      検査を通ったものだけを使い、ヘッダ値からは制御文字を落とす。
 *   2. 平文での認証。STARTTLS も implicit TLS も無い接続に認証情報を
 *      流すと、経路上で読める。既定では拒否する。
 *   3. 証明書の検証。無効化する経路は用意しない。
 *   4. 時間。送信は HTTP 応答を待たせない（呼び出し側が待たない）が、
 *      それでも各段階に時間切れを置く。応答しない SMTP に繋いだまま
 *      接続を溜めると、それ自体が資源になる。
 */
import crypto from 'node:crypto'
import net from 'node:net'
import tls from 'node:tls'
import { spawn } from 'node:child_process'

/** 各段階の待ち時間。合計で 1 分を超えないようにする。 */
const STEP_TIMEOUT_MS = 10_000
const CONNECT_TIMEOUT_MS = 10_000

/**
 * アドレスの検査。
 *
 * RFC に完全準拠した判定はしない（正しく書くと巨大になり、しかも
 * 通ったからといって届くわけではない）。ここで落としたいのは
 * 「ヘッダに入れると危険なもの」と「明らかに宛先でないもの」だけ。
 */
const ADDRESS_RE = /^[^\s@<>,;:"()[\]\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

export function isMailAddress(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  // 254 は SMTP の実務上の上限。長すぎるものは受け取り側で弾かれる。
  if (trimmed.length < 3 || trimmed.length > 254) return false
  // 制御文字が 1 つでもあれば、検査に通す前に落とす
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false
  return ADDRESS_RE.test(trimmed)
}

/** ヘッダ値から改行と制御文字を落とす。差し込みを防ぐ最後の砦。 */
function headerSafe(value) {
  return String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
}

/**
 * 日本語の件名をそのまま置くと文字化けするため RFC 2047 で符号化する。
 * base64 を使うのは、日本語だと quoted-printable のほうが長くなるため。
 */
function encodeHeaderValue(value) {
  const safe = headerSafe(value)
  if (/^[\x20-\x7e]*$/.test(safe)) return safe
  return `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`
}

/**
 * SMTP の DATA で送る本文を組み立てる。
 *
 * base64 にするのは、行長の上限（998 バイト）と、行頭のピリオドが
 * 終端と解釈される問題を一度に避けられるため。base64 の文字集合には
 * ピリオドが無いので、ドットスタッフィングが必要になる本文が作られない。
 */
function buildMessage({ from, to, subject, text, messageId, date }) {
  const headers = [
    `From: ${headerSafe(from)}`,
    `To: ${headerSafe(to)}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    `Date: ${date}`,
    `Message-ID: ${headerSafe(messageId)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    // 再設定メールは自動送信なので、不在通知や自動返信を呼ばない
    'Auto-Submitted: auto-generated',
  ]
  const body = Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n')
  return `${headers.join('\r\n')}\r\n\r\n${body}\r\n`
}

/** SMTP の 1 往復。応答コードが期待と違えば例外にする。 */
class SmtpSession {
  #socket
  #buffer = ''
  #waiter = null

  constructor(socket) {
    this.#attach(socket)
  }

  #attach(socket) {
    this.#socket = socket
    socket.setEncoding('utf8')
    socket.on('data', (chunk) => {
      this.#buffer += chunk
      this.#drain()
    })
    socket.on('error', (err) => this.#fail(err))
    socket.on('close', () => this.#fail(new Error('SMTP 接続が切れました')))
  }

  #drain() {
    if (!this.#waiter) return
    // 複数行応答は "250-..." が続き、最後だけ "250 ..." になる
    const lines = this.#buffer.split('\r\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (/^\d{3} /.test(line)) {
        const consumed = lines.slice(0, i + 1).join('\r\n')
        this.#buffer = this.#buffer.slice(consumed.length + 2)
        const waiter = this.#waiter
        this.#waiter = null
        clearTimeout(waiter.timer)
        waiter.resolve({ code: Number(line.slice(0, 3)), text: consumed })
        return
      }
    }
  }

  #fail(err) {
    const waiter = this.#waiter
    this.#waiter = null
    if (waiter) {
      clearTimeout(waiter.timer)
      waiter.reject(err)
    }
  }

  read() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiter = null
        reject(new Error('SMTP の応答がありません（時間切れ）'))
      }, STEP_TIMEOUT_MS)
      this.#waiter = { resolve, reject, timer }
      this.#drain()
    })
  }

  /**
   * 送って応答を確認する。
   * secret が真のときはコマンドを記録しない（AUTH の引数が漏れないように）。
   */
  async command(line, expected, { secret = false } = {}) {
    this.#socket.write(`${line}\r\n`)
    const res = await this.read()
    if (!expected.includes(res.code)) {
      const shown = secret ? '(認証情報)' : line
      throw new Error(`SMTP が ${shown} を拒否しました: ${res.text}`)
    }
    return res
  }

  writeRaw(data) {
    this.#socket.write(data)
  }

  upgrade(host) {
    return new Promise((resolve, reject) => {
      const plain = this.#socket
      plain.removeAllListeners('data')
      plain.removeAllListeners('error')
      plain.removeAllListeners('close')
      // servername を渡さないと SNI が無く、証明書の検証が通らない
      const secure = tls.connect({ socket: plain, servername: host }, () => {
        this.#buffer = ''
        this.#attach(secure)
        resolve()
      })
      secure.once('error', reject)
    })
  }

  close() {
    try {
      this.#socket.write('QUIT\r\n')
      this.#socket.end()
    } catch {
      // 送り終わっているので、閉じ方の失敗は無視してよい
    }
  }
}

function connect({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port })
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => {
      socket.destroy(new Error(`SMTP に接続できません: ${host}:${port}（時間切れ）`))
    })
    socket.once(secure ? 'secureConnect' : 'connect', () => {
      socket.setTimeout(0)
      resolve(socket)
    })
    socket.once('error', reject)
  })
}

async function sendViaSmtp(config, message, envelope) {
  const socket = await connect(config)
  const session = new SmtpSession(socket)
  try {
    const greeting = await session.read()
    if (greeting.code !== 220) throw new Error(`SMTP の挨拶が不正です: ${greeting.text}`)

    let caps = await session.command(`EHLO ${config.heloName}`, [250])
    let encrypted = config.secure

    if (!encrypted && /STARTTLS/i.test(caps.text)) {
      await session.command('STARTTLS', [220])
      await session.upgrade(config.host)
      // TLS を張ったら EHLO をやり直す。暗号化前の能力宣言は信用できない。
      caps = await session.command(`EHLO ${config.heloName}`, [250])
      encrypted = true
    }

    if (config.user) {
      if (!encrypted && !config.allowPlaintext) {
        throw new Error(
          '暗号化されていない接続に認証情報を送ろうとしました。' +
            'SMTP_PORT=465 か STARTTLS 対応のサーバーを使ってください' +
            '（同一ホストのリレーに限り SMTP_ALLOW_PLAINTEXT=1 で明示的に許可できます）',
        )
      }
      if (/AUTH[ =-][^\r\n]*PLAIN/i.test(caps.text)) {
        const token = Buffer.from(`\u0000${config.user}\u0000${config.pass}`, 'utf8').toString('base64')
        await session.command(`AUTH PLAIN ${token}`, [235], { secret: true })
      } else if (/AUTH[ =-][^\r\n]*LOGIN/i.test(caps.text)) {
        await session.command('AUTH LOGIN', [334])
        await session.command(Buffer.from(config.user, 'utf8').toString('base64'), [334], {
          secret: true,
        })
        await session.command(Buffer.from(config.pass, 'utf8').toString('base64'), [235], {
          secret: true,
        })
      } else {
        throw new Error('SMTP サーバーが PLAIN / LOGIN 認証に対応していません')
      }
    }

    await session.command(`MAIL FROM:<${envelope.from}>`, [250])
    await session.command(`RCPT TO:<${envelope.to}>`, [250, 251])
    await session.command('DATA', [354])
    session.writeRaw(message)
    await session.command('.', [250])
    session.close()
  } catch (err) {
    session.close()
    throw err
  }
}

function sendViaSendmail(command, message, envelope) {
  return new Promise((resolve, reject) => {
    // 宛先はコマンド引数に渡さず -t でヘッダから読ませる。引数に入れると、
    // 検査を抜けた文字列がそのままコマンドラインに乗る経路ができる。
    const child = spawn(command, ['-t', '-i', '-f', envelope.from], { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      stderr += chunk.slice(0, 2000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`sendmail が失敗しました (code=${code}): ${stderr.trim()}`))
    })
    child.stdin.end(message)
  })
}

export class MailError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'MailError'
    this.status = status
  }
}

/**
 * 環境変数から送信手段を組み立てる。
 *
 * 設定の誤りは起動時に分かるようにしたい。実際に送るまで気づかないと、
 * 「再設定メールが来ない」という形でしか表面化しない。
 */
export class Mailer {
  constructor(env = process.env, { log = console.error } = {}) {
    this.transport = env.MAIL_TRANSPORT ?? 'none'
    this.log = log
    this.from = (env.MAIL_FROM ?? '').trim()
    this.sendmailPath = env.SENDMAIL_PATH ?? '/usr/sbin/sendmail'
    this.smtp = {
      host: env.SMTP_HOST ?? '',
      port: Number(env.SMTP_PORT ?? 587),
      user: env.SMTP_USER ?? '',
      pass: env.SMTP_PASS ?? '',
      // 465 は接続時から TLS、587 は STARTTLS で昇格させる
      secure: Number(env.SMTP_PORT ?? 587) === 465,
      allowPlaintext: env.SMTP_ALLOW_PLAINTEXT === '1',
      heloName: env.SMTP_HELO_NAME ?? 'localhost',
    }

    this.problems = []
    if (this.transport !== 'none') {
      if (!this.from) this.problems.push('MAIL_FROM が未設定です')
      else if (!isMailAddress(this.from)) this.problems.push(`MAIL_FROM が不正です: ${this.from}`)
    }
    if (this.transport === 'smtp' && !this.smtp.host) {
      this.problems.push('SMTP_HOST が未設定です')
    }
    if (this.transport === 'smtp' && this.smtp.user && !this.smtp.pass) {
      this.problems.push('SMTP_USER があるのに SMTP_PASS が未設定です')
    }
    if (!['none', 'smtp', 'sendmail'].includes(this.transport)) {
      this.problems.push(`MAIL_TRANSPORT が不明な値です: ${this.transport}`)
    }
  }

  /** 送信できる状態か。UI と /api/health がこれを見て機能の有無を出す。 */
  get enabled() {
    return this.transport !== 'none' && this.problems.length === 0
  }

  describe() {
    return { transport: this.transport, enabled: this.enabled, problems: this.problems }
  }

  /**
   * 1 通送る。
   *
   * 呼び出し側は待たない設計だが、失敗は必ず記録する。黙って落とすと
   * 「再設定できない」という問い合わせに対して調べる材料が無くなる。
   * 記録には本文を残さない（再設定リンクが log に残るため）。
   */
  async send({ to, subject, text }) {
    if (!this.enabled) {
      throw new MailError('メール送信が設定されていません', 503)
    }
    if (!isMailAddress(to)) {
      throw new MailError('宛先のアドレスが不正です', 400)
    }
    const envelope = { from: this.from, to: to.trim() }
    const message = buildMessage({
      from: this.from,
      to: envelope.to,
      subject,
      text,
      date: new Date().toUTCString(),
      messageId: `<${crypto.randomUUID()}@${this.from.split('@')[1]}>`,
    })

    if (this.transport === 'sendmail') {
      return await sendViaSendmail(this.sendmailPath, message, envelope)
    }
    return await sendViaSmtp(this.smtp, message, envelope)
  }

  /** 応答を待たせずに送る。宛先も件名も記録するが本文は記録しない。 */
  sendInBackground(mail) {
    this.send(mail).catch((err) => {
      this.log(`[mail] 送信失敗 to=${mail.to} subject=${mail.subject}: ${err.message}`)
    })
  }
}

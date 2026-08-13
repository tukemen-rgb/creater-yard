/**
 * 通報の受け付け。GAMEYARD（server/lib/reports.mjs）の縮約。
 *
 * 権利侵害や不適切な内容の申し立ては、**アカウントなしで出せる**必要がある。
 * 権利者にアカウント作成を求めるのは、窓口として成立しない（自分の文章や
 * 画像を盗まれた側に会員登録させる筋合いがない）。そのため認証は要求せず、
 * 送信元ごとの割当（gate）だけで濫用を抑える。
 *
 * 受け取った通報で自動的に公開を止めることはしない。それができると、
 * 通報を送るだけで他人の Story を落とせてしまう。判断は運営が行う前提で、
 * ここは「記録して運営が見られる状態にする」ところまでを担う。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export class ReportError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ReportError'
    this.status = status
  }
}

/**
 * 通報の状態。受け付けたまま増えていく一覧は、しばらくすると誰も
 * 見なくなる。「対応済み」と「未対応」を区別できる形にしておく。
 */
export const REPORT_STATUSES = {
  open: '未対応',
  reviewing: '確認中',
  resolved: '対応済み',
  rejected: '対応不要と判断',
}

/** 通報の種別。Story（文章と画像）に合わせた粒度。 */
export const REPORT_CATEGORIES = {
  copyright: '著作権・権利侵害',
  inappropriate: '不適切な内容',
  privacy: '個人情報・プライバシー',
  spam: 'スパム・宣伝',
  other: 'その他',
}

const LIMITS = {
  detail: 4000,
  contact: 200,
  target: 100,
  /** 保持する通報の総数。超えたら受付を止める（黙って捨てない）。 */
  maxStored: 10_000,
}

/**
 * 受付番号の文字（GAMEYARD と同じ設計）。
 * Crockford の base32 から I / L / O / U を除いたもの。通報者が電話や
 * メールで読み上げることを想定していて、0 と O、1 と I を取り違えられると
 * 照合できない。番号は照合のためだけのもので、これで内容は読めない
 * （読める経路を作ると、総当たりで他人の通報が漏れる）。
 */
const TICKET_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function makeTicket() {
  const bytes = crypto.randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i += 1) out += TICKET_ALPHABET[bytes[i] % TICKET_ALPHABET.length]
  return `R-${out.slice(0, 4)}-${out.slice(4)}`
}

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .trim()
    .slice(0, max)
}

export class ReportStore {
  #dir

  constructor({ dir, now = () => Date.now() }) {
    this.#dir = dir
    this.now = now
    fs.mkdirSync(dir, { recursive: true })
  }

  #file(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ReportError('通報が見つかりません。', 404)
    return path.join(this.#dir, `${id}.json`)
  }

  #readAll() {
    let names
    try {
      names = fs.readdirSync(this.#dir)
    } catch {
      return []
    }
    const out = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      try {
        out.push(JSON.parse(fs.readFileSync(path.join(this.#dir, name), 'utf8')))
      } catch {
        /* 壊れた 1 件で全体を止めない */
      }
    }
    return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }

  /**
   * 通報を受け付ける。
   * @param {object} input
   * @param {string} input.target  対象（Story の ID・書き手のハンドル・URL など、
   *   通報者が指せる形なら何でも。厳密な形式は求めない — 権利者は
   *   このサイトの ID 体系を知らない）
   */
  create({ target, category, detail, contact }) {
    if (this.#readAll().length >= LIMITS.maxStored) {
      throw new ReportError(
        '通報の受付が混み合っています。時間をおいてお試しください。',
        503,
      )
    }
    const cleanTarget = cleanText(target, LIMITS.target)
    if (!cleanTarget) throw new ReportError('対象（Story の URL や ID など）を入れてください。')
    if (!Object.hasOwn(REPORT_CATEGORIES, category)) {
      throw new ReportError('通報の種別を選んでください。')
    }
    const cleanDetail = cleanText(detail, LIMITS.detail)
    if (cleanDetail.length < 10) {
      throw new ReportError('内容を 10 文字以上で書いてください（判断の材料になります）。')
    }
    const record = {
      id: crypto.randomUUID(),
      ticket: makeTicket(),
      target: cleanTarget,
      category,
      detail: cleanDetail,
      contact: cleanText(contact, LIMITS.contact),
      status: 'open',
      note: '',
      createdAt: new Date(this.now()).toISOString(),
      updatedAt: new Date(this.now()).toISOString(),
    }
    fs.writeFileSync(this.#file(record.id), JSON.stringify(record, null, 2), {
      flag: 'wx',
      mode: 0o600,
    })
    // 通報者に返すのは受付番号だけ。内部 ID は運営用
    return { ticket: record.ticket }
  }

  /** 運営用の一覧。status で絞れる。 */
  list({ status = '' } = {}) {
    let records = this.#readAll()
    if (status) {
      if (!Object.hasOwn(REPORT_STATUSES, status)) {
        throw new ReportError('状態の指定が正しくありません。')
      }
      records = records.filter((r) => r.status === status)
    }
    return records
  }

  /** 運営用の状態更新。対応メモも一緒に残す。 */
  update(id, { status, note }) {
    let record
    try {
      record = JSON.parse(fs.readFileSync(this.#file(id), 'utf8'))
    } catch {
      throw new ReportError('通報が見つかりません。', 404)
    }
    if (status !== undefined) {
      if (!Object.hasOwn(REPORT_STATUSES, status)) {
        throw new ReportError('状態の指定が正しくありません。')
      }
      record.status = status
    }
    if (note !== undefined) record.note = cleanText(note, LIMITS.detail)
    record.updatedAt = new Date(this.now()).toISOString()
    const tmp = `${this.#file(id)}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, this.#file(id))
    return record
  }
}

/**
 * 出品（スキル・Recipe・テンプレート・Mentor 受付）のレコード置き場。
 *
 * 2026-08-16 の収益戦略決定（docs/REVENUE.md）による前倒し実装。
 * CreatorYard が持つのは**陳列と導線だけ**。価格は自由記述の表示で、
 * 購入・依頼・支払いはすべて本人の外部リンク先で行われる（D-CY4 維持 —
 * サイトは金銭のやり取りに入らない）。だからこのストアには金額の数値も
 * 在庫も購入記録も無い。
 *
 * 作りは stories.mjs と同じ型（1 件 1 JSON・公開/下書き・本人のみ編集）。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export class OfferError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'OfferError'
    this.status = status
  }
}

/** 出品の種別。収益戦略決定の 4 本柱そのまま。 */
export const OFFER_TYPES = {
  skill: 'スキル',
  recipe: 'Recipe',
  template: 'テンプレート',
  mentor: 'Mentor',
}

export const OFFER_LIMITS = {
  titleMax: 80,
  bodyMinPublic: 10,
  bodyMax: 4000,
  priceMax: 40,
  urlMax: 300,
  /** 1 人あたりの出品数。書き潰し対策（Story と同じ思想で少し小さめ）。 */
  maxPerAuthor: 100,
  perPage: 20,
}

const ID_RE = /^[A-Za-z0-9_-]{8}$/

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/**
 * 外部リンクの検査。
 *
 * Story の作品リンク（GAMEYARD のみ）と違い、出品の行き先は本人の
 * 販売ページ（Booth・Stripe・自サイト等）なので**ホストは限定しない**。
 * その代わり:
 *   - https のみ（http・javascript: 等は URL ごと拒否）
 *   - 表示側は rel="nofollow noopener ugc" ＋ドメイン併記（リンク先の
 *     信用をサイトが肩代わりしない。SEO 的にも被リンクを売り物にさせない）
 */
function normalizeExternalUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    throw new OfferError(
      '外部リンクを入れてください。購入・依頼はリンク先で行われます（このサイトは決済を持ちません）。',
    )
  }
  if (raw.length > OFFER_LIMITS.urlMax) {
    throw new OfferError(`外部リンクは${OFFER_LIMITS.urlMax}文字以内にしてください。`)
  }
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new OfferError('外部リンクが URL として読めません。')
  }
  if (url.protocol !== 'https:') {
    throw new OfferError('外部リンクは https のものだけ使えます。')
  }
  return url.href
}

export class OfferStore {
  #dir

  constructor({ dir, now = () => Date.now() }) {
    this.#dir = dir
    this.now = now
    fs.mkdirSync(dir, { recursive: true })
  }

  #file(id) {
    if (!ID_RE.test(id)) throw new OfferError('出品の ID が正しくありません。', 404)
    return path.join(this.#dir, `${id}.json`)
  }

  #write(record) {
    const file = this.#file(record.id)
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2))
    fs.renameSync(tmp, file)
  }

  get(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return null
    try {
      return JSON.parse(fs.readFileSync(this.#file(id), 'utf8'))
    } catch {
      return null
    }
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
      if (!name.endsWith('.json') || name.endsWith('.tmp')) continue
      try {
        const record = JSON.parse(fs.readFileSync(path.join(this.#dir, name), 'utf8'))
        if (record?.id && ID_RE.test(record.id)) out.push(record)
      } catch {
        /* 壊れた 1 件はスキップ */
      }
    }
    return out
  }

  #validate(input) {
    const status = input.status === 'draft' ? 'draft' : 'public'
    if (!Object.hasOwn(OFFER_TYPES, input.type)) {
      throw new OfferError('出品の種別を選んでください。')
    }
    const title = cleanText(input.title, OFFER_LIMITS.titleMax)
    if (!title) throw new OfferError('タイトルを入れてください。')
    const body = cleanText(input.body, OFFER_LIMITS.bodyMax)
    if (status === 'public' && body.length < OFFER_LIMITS.bodyMinPublic) {
      throw new OfferError(
        `公開する説明は${OFFER_LIMITS.bodyMinPublic}文字以上にしてください（下書き保存なら短くても構いません）。`,
      )
    }
    return {
      status,
      type: input.type,
      title,
      body,
      // 価格は自由記述の**表示**（例: ¥3,000 / 応相談 / 無料）。
      // 数値で持たないのは、サイトが決済に関与しない線をデータ構造でも
      // 引いておくため（数値で持った瞬間、合計や手数料の計算がしたくなる）
      priceLabel: cleanText(input.priceLabel, OFFER_LIMITS.priceMax),
      externalUrl: status === 'public' || String(input.externalUrl ?? '').trim()
        ? normalizeExternalUrl(input.externalUrl)
        : '',
    }
  }

  create(account, input) {
    if (this.listByAuthor(account.id).length >= OFFER_LIMITS.maxPerAuthor) {
      throw new OfferError(
        `1 アカウントの出品は ${OFFER_LIMITS.maxPerAuthor} 件までです。`,
        403,
      )
    }
    const fields = this.#validate(input)
    const nowIso = new Date(this.now()).toISOString()
    const record = {
      id: crypto.randomBytes(6).toString('base64url'),
      authorId: account.id,
      authorHandle: account.handle,
      ...fields,
      createdAt: nowIso,
      updatedAt: nowIso,
      publishedAt: fields.status === 'public' ? nowIso : null,
    }
    fs.writeFileSync(this.#file(record.id), JSON.stringify(record, null, 2), { flag: 'wx' })
    return record
  }

  update(id, account, input) {
    const record = this.get(id)
    if (!record) throw new OfferError('出品が見つかりません。', 404)
    if (record.authorId !== account.id) {
      throw new OfferError('この出品を編集できるのは本人だけです。', 403)
    }
    const fields = this.#validate(input)
    const nowIso = new Date(this.now()).toISOString()
    const next = {
      ...record,
      ...fields,
      updatedAt: nowIso,
      publishedAt: fields.status === 'public' ? (record.publishedAt ?? nowIso) : record.publishedAt,
    }
    this.#write(next)
    return next
  }

  remove(id, account) {
    const record = this.get(id)
    if (!record) throw new OfferError('出品が見つかりません。', 404)
    if (record.authorId !== account.id) {
      throw new OfferError('この出品を消せるのは本人だけです。', 403)
    }
    fs.rmSync(this.#file(id), { force: true })
    return record
  }

  /** 退会時に全部消す（Story と同じ — 記録は本人のもの）。 */
  removeByAuthor(authorId) {
    let removed = 0
    for (const record of this.#readAll()) {
      if (record.authorId !== authorId) continue
      fs.rmSync(this.#file(record.id), { force: true })
      removed += 1
    }
    return removed
  }

  listByAuthor(authorId) {
    return this.#readAll()
      .filter((r) => r.authorId === authorId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }

  listPublic({ page = 1, type = '', handle = '' } = {}) {
    let records = this.#readAll().filter((r) => r.status === 'public')
    if (type) {
      if (!Object.hasOwn(OFFER_TYPES, type)) {
        throw new OfferError('出品の種別が正しくありません。')
      }
      records = records.filter((r) => r.type === type)
    }
    const byHandle = String(handle ?? '').trim()
    if (byHandle) records = records.filter((r) => r.authorHandle === byHandle)
    records.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))

    const perPage = OFFER_LIMITS.perPage
    const totalPages = Math.max(1, Math.ceil(records.length / perPage))
    const current = Math.min(Math.max(1, Number(page) || 1), totalPages)
    return {
      offers: records.slice((current - 1) * perPage, current * perPage).map(publicOffer),
      total: records.length,
      page: current,
      totalPages,
    }
  }

  /** sitemap 用の最小索引。 */
  publicIndex() {
    return this.#readAll()
      .filter((r) => r.status === 'public')
      .map((r) => ({ id: r.id, updatedAt: r.updatedAt, publishedAt: r.publishedAt }))
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  }
}

/** 外に出す形。authorId（内部 ID）は出さない。 */
export function publicOffer(record) {
  return {
    id: record.id,
    authorHandle: record.authorHandle,
    type: record.type,
    title: record.title,
    body: record.body,
    priceLabel: record.priceLabel ?? '',
    externalUrl: record.externalUrl ?? '',
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
  }
}

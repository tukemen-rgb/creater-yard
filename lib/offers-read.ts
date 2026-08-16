import fs from 'node:fs'
import path from 'node:path'

import type { Offer, OfferListing, OfferType } from './api'

/**
 * 出品の読み出し（サーバー側）。stories-read.ts と同じ型 —
 * 書き込みは API（server/lib/offers.mjs）だけが行い、こちらは読むだけ。
 * server モードの Next.js がリクエスト時にここを読んで HTML を組み立てる。
 */

const DATA_DIR = process.env.CY_DATA_DIR ?? path.join(process.cwd(), 'server', 'store')
const OFFERS_DIR = path.join(DATA_DIR, 'offers')

const ID_RE = /^[A-Za-z0-9_-]{8}$/
const PER_PAGE = 20
const TYPES = new Set(['skill', 'recipe', 'template', 'mentor'])

/** ファイル名 -> {mtimeMs, 解析結果}。ファイルが真実で、ここは捨てても動く。 */
const parsed = new Map<string, { mtimeMs: number; record: Offer }>()

function readRecord(name: string): Offer | null {
  const file = path.join(OFFERS_DIR, name)
  let mtimeMs: number
  try {
    mtimeMs = fs.statSync(file).mtimeMs
  } catch {
    return null
  }
  const cached = parsed.get(name)
  if (cached && cached.mtimeMs === mtimeMs) return cached.record
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8')) as Offer
    if (!record?.id || !ID_RE.test(record.id)) return null
    parsed.set(name, { mtimeMs, record })
    return record
  } catch {
    return null
  }
}

function publishedRecords(): Offer[] {
  let names: string[]
  try {
    names = fs.readdirSync(OFFERS_DIR)
  } catch {
    return []
  }
  const records: Offer[] = []
  for (const name of names) {
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue
    const record = readRecord(name)
    if (record && record.status === 'public') records.push(record)
  }
  records.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  return records
}

export function publishedOffers({
  page = 1,
  type = '',
  handle = '',
}: { page?: number; type?: string; handle?: string } = {}): OfferListing {
  let records = publishedRecords()
  if (type && TYPES.has(type)) records = records.filter((r) => r.type === (type as OfferType))
  if (handle) records = records.filter((r) => r.authorHandle === handle)
  const totalPages = Math.max(1, Math.ceil(records.length / PER_PAGE))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  return {
    offers: records.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    total: records.length,
    page: current,
    totalPages,
  }
}

/** 公開済みの 1 件。下書きは返さない（本人の閲覧は API＋トークンの仕事）。 */
export function publishedOffer(id: string): Offer | null {
  if (!ID_RE.test(id)) return null
  const record = readRecord(`${id}.json`)
  return record && record.status === 'public' ? record : null
}

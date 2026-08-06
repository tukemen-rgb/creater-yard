import fs from 'node:fs'
import path from 'node:path'

import type { Story, StoryListing, TagIndex } from './api'

/**
 * Story の読み出し（サーバー側）。GAMEYARD の lib/uploads.ts と同じ型。
 *
 * 書き込みは API（server/api.mjs → server/lib/stories.mjs）だけが行い、
 * こちらは**読むだけ**。同じディレクトリを 2 つのプロセスが読み書きする
 * 形にしているのは、公開から表示までの間にビルドを挟まないため。
 * server モードの Next.js がリクエスト時にここを読んで HTML を組み立てる
 * — 検索に拾われることがタグ SEO（ACQUISITION A1）の前提なので、
 * 本文はブラウザの fetch ではなく HTML に入っている必要がある。
 *
 * 解析結果はファイルの更新時刻をつけて憶える。ディレクトリの一覧と各
 * ファイルの stat は毎回取り直すので、「公開したのに出ない」は起きない。
 */

const DATA_DIR = process.env.CY_DATA_DIR ?? path.join(process.cwd(), 'server', 'store')
const STORIES_DIR = path.join(DATA_DIR, 'stories')

const ID_RE = /^[A-Za-z0-9_-]{8}$/
const PER_PAGE = 20

/** ファイル名 -> {mtimeMs, 解析結果}。ファイルが真実で、ここは捨てても動く。 */
const parsed = new Map<string, { mtimeMs: number; record: Story }>()

function readRecord(name: string): Story | null {
  const file = path.join(STORIES_DIR, name)
  let mtimeMs: number
  try {
    mtimeMs = fs.statSync(file).mtimeMs
  } catch {
    return null
  }
  const cached = parsed.get(name)
  if (cached && cached.mtimeMs === mtimeMs) return cached.record
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8')) as Story
    if (!record?.id || !ID_RE.test(record.id)) return null
    parsed.set(name, { mtimeMs, record })
    return record
  } catch {
    // 書き込み途中・壊れた 1 件で全体を止めない
    return null
  }
}

/** 公開済みの全 Story。新着順（公開時刻の降順）。 */
function publishedRecords(): Story[] {
  let names: string[]
  try {
    names = fs.readdirSync(STORIES_DIR)
  } catch {
    return []
  }
  const records: Story[] = []
  for (const name of names) {
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue
    const record = readRecord(name)
    if (record && record.status === 'public') records.push(record)
  }
  records.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  return records
}

function paginate(records: Story[], page: number): StoryListing {
  const totalPages = Math.max(1, Math.ceil(records.length / PER_PAGE))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  return {
    stories: records.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    total: records.length,
    page: current,
    totalPages,
  }
}

/**
 * 公開一覧。tool / topic は保存時に正規化済み（NFKC・小文字）なので、
 * 同じ形に揃えてから比べる。
 */
export function publishedStories({
  page = 1,
  tool = '',
  topic = '',
}: { page?: number; tool?: string; topic?: string } = {}): StoryListing {
  const toolTag = tool.normalize('NFKC').toLowerCase().trim()
  const topicTag = topic.normalize('NFKC').toLowerCase().trim()
  let records = publishedRecords()
  if (toolTag) records = records.filter((r) => r.toolTags.includes(toolTag))
  if (topicTag) records = records.filter((r) => r.topicTags.includes(topicTag))
  return paginate(records, page)
}

/** 公開済みの 1 件。下書きは返さない（下書きの閲覧は API＋本人トークンの仕事）。 */
export function publishedStory(id: string): Story | null {
  if (!ID_RE.test(id)) return null
  const record = readRecord(`${id}.json`)
  return record && record.status === 'public' ? record : null
}

/** その人の公開 Story（Timeline の原型）。 */
export function creatorStories(handle: string, page = 1): StoryListing {
  return paginate(
    publishedRecords().filter((r) => r.authorHandle === handle),
    page,
  )
}

/** タグ索引。サイト全体の合計値だけを数える（個人単位の計測はしない）。 */
export function tagIndex(): TagIndex {
  const tools = new Map<string, number>()
  const topics = new Map<string, number>()
  for (const record of publishedRecords()) {
    for (const tag of record.toolTags) tools.set(tag, (tools.get(tag) ?? 0) + 1)
    for (const tag of record.topicTags) topics.set(tag, (topics.get(tag) ?? 0) + 1)
  }
  const toSorted = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }))
  return { tools: toSorted(tools), topics: toSorted(topics) }
}

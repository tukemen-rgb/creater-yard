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

/** 新着を起点に、作者ごとの最新 1 件を一巡してから 2 件目へ進む。 */
function interleaveAuthors(records: Story[]): Story[] {
  const queues = new Map<string, Story[]>()
  for (const record of records) {
    const queue = queues.get(record.authorHandle) ?? []
    queue.push(record)
    queues.set(record.authorHandle, queue)
  }
  const mixed: Story[] = []
  let remaining = records.length
  while (remaining > 0) {
    for (const queue of queues.values()) {
      const record = queue.shift()
      if (!record) continue
      mixed.push(record)
      remaining -= 1
    }
  }
  return mixed
}

/** 公開済みの全 Story。ここでは絞り込み前の新着順を保つ。 */
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
  records.sort(
    (a, b) =>
      String(b.publishedAt).localeCompare(String(a.publishedAt)) || a.id.localeCompare(b.id),
  )
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
  return paginate(interleaveAuthors(records), page)
}

/** 公開済みの 1 件。下書きは返さない（下書きの閲覧は API＋本人トークンの仕事）。 */
export function publishedStory(id: string): Story | null {
  if (!ID_RE.test(id)) return null
  const record = readRecord(`${id}.json`)
  return record && record.status === 'public' ? record : null
}

/**
 * 現在の Story より前に公開された、別の作者の Story を最大 1 件返す。
 *
 * 閲覧履歴・人気・タグ点数を使わず、公開時刻を古い方へ一方向に進む。
 * これにより同じ 2 件を往復させず、候補がなければ無理に推薦しない。
 */
export function nextStoryFromAnotherAuthor(current: Story): Story | null {
  const records = publishedRecords()
  const currentIndex = records.findIndex((record) => record.id === current.id)
  if (currentIndex < 0) return null
  return records
    .slice(currentIndex + 1)
    .find((record) => record.authorHandle !== current.authorHandle) ?? null
}

/** その人の公開 Story（Timeline の原型）。 */
export function creatorStories(handle: string, page = 1): StoryListing {
  return paginate(
    publishedRecords().filter((r) => r.authorHandle === handle),
    page,
  )
}

/**
 * タグの並び。server/lib/stories.mjs の byTagName と**同じ規則**にそろえる。
 * 片方だけ直すと SSR と静的書き出しで並びが食い違う。
 * 同値解決の理由は stories.mjs 側の註釈を見ること。
 */
const tagCollator = new Intl.Collator('ja')
function byTagName(a: string, b: string): number {
  return tagCollator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0)
}

/**
 * タグ索引（公開 Story の語彙。名前だけで、数は持たない）。
 *
 * `toolNames` は「小文字のタグ → 書き手が打った書き方」の対応表（設計 U-6）。
 * **タグの値は小文字のまま**（`Godot` と `GODOT` を束ねるために要る）で、
 * 画面に出すときだけこれを引く。**server/lib/stories.mjs の tagIndex と
 * 同じ規則にそろえること**（byTagName と同じ理由。片方だけ直すと SSR と
 * 静的書き出しで表示が食い違う）。
 *
 * 規則は 3 つ:
 *   1. 書き方は「使ったツール」欄から採る（タグ側には残っていない）
 *   2. 同じ語に 2 通りの書き方があったら、どちらも採らない（小文字のまま）
 *   3. 見つからなければ小文字のまま（**推測で名前を作らない**）
 */
export function tagIndex(): TagIndex {
  const tools = new Set<string>()
  const topics = new Set<string>()
  const names = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const record of publishedRecords()) {
    for (const tag of record.toolTags) tools.add(tag)
    for (const tag of record.topicTags) topics.add(tag)
    for (const tool of record.tools ?? []) {
      const key = tool.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
      if (!key || key === tool) continue
      const known = names.get(key)
      if (known !== undefined && known !== tool) ambiguous.add(key)
      names.set(key, tool)
    }
  }
  for (const key of ambiguous) names.delete(key)
  return {
    tools: [...tools].sort(byTagName),
    topics: [...topics].sort(byTagName),
    toolNames: Object.fromEntries([...names].filter(([key]) => tools.has(key))),
  }
}

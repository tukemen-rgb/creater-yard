/**
 * Story の保存（CreatorYard の中身。designs.md 2026-08-08 18:22 段階 A）。
 *
 * 1 件 1 ファイル（data/stories/<id>.json）。DB を持たないのは SPEC §3 の
 * 決まり（規模が来たら考える — 来ることが先）。
 *
 * id は乱数 slug で、投稿者に選ばせない。選ばせると衝突の解決と
 * 予約語の管理が仕事になり、下書きの URL を推測される面も作る。
 *
 * 意図して入れていないもの:
 *   - 画像。添付は検査（GAMEYARD は ClamAV 8 段階）を伴い、検査体制を
 *     どう持つかは運用の判断。検査なしの受け口を先に作らない
 *   - 削除。「記録は本人のもの（消す自由）」の文化上必須だが、退会と
 *     一緒に扱う段階で入れる（作品だけ消える・アカウントだけ残る、の
 *     半端な状態を作らないため）
 *   - 閲覧数などの計測。持つのは記録そのものだけ
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export class StoryError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'StoryError'
    this.status = status
  }
}

/** 上限。緩めるのは人の判断（docs/autonomous-loop.md）。 */
const LIMITS = {
  title: 120,
  body: 20_000,
  tool: 50,
  tools: 10,
  hurdleText: 200,
  tagsPerAxis: 5,
  tag: 50,
}

/** GAMEYARD の作品 URL だけを受ける。一般の外部リンク欄は作らない。 */
const GAMEYARD_PREFIX = 'https://play-game-yard.com/'

const ID_BYTES = 8

function requireText(value, name, max, { allowEmpty = false } = {}) {
  const text = String(value ?? '').trim()
  if (!text && !allowEmpty) throw new StoryError(`${name}を入れてください。`)
  if (text.length > max) throw new StoryError(`${name}は${max}文字以内にしてください。`)
  return text
}

function normalizeList(value, name, maxItems, maxLength) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new StoryError(`${name}の形式が不正です。`)
  const items = value.map((item) => String(item ?? '').trim()).filter(Boolean)
  if (items.length > maxItems) {
    throw new StoryError(`${name}は${maxItems}個までにしてください。`)
  }
  for (const item of items) {
    if (item.length > maxLength) {
      throw new StoryError(`${name}の各項目は${maxLength}文字以内にしてください。`)
    }
  }
  return items
}

/**
 * タグ 1 語の正規化（designs 00:22）。表記ゆれで語彙が薄く分散するのを防ぐ。
 * 小文字化は ASCII だけ（日本語のタグはそのまま）。全部を NFKC 等まで
 * やらないのは、書いた形と表示が変わりすぎると本人が戸惑うため。
 */
export function normalizeTag(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[A-Z]+/g, (chars) => chars.toLowerCase())
}

function normalizeTagList(value, name, maxItems, maxLength) {
  const normalized = normalizeList(value, name, maxItems, maxLength).map(normalizeTag)
  // 正規化で同じ語になったものは黙って 1 つにする（エラーにしない）
  return [...new Set(normalized)]
}

function normalizeInput(input) {
  const story = {
    title: requireText(input.title, 'タイトル', LIMITS.title),
    body: requireText(input.body, '本文', LIMITS.body),
    tools: normalizeList(input.tools, '使ったツール', LIMITS.tools, LIMITS.tool),
    tags: {
      tool: normalizeTagList(input.tags?.tool, 'ツールのタグ', LIMITS.tagsPerAxis, LIMITS.tag),
      topic: normalizeTagList(input.tags?.topic, 'つまずきのタグ', LIMITS.tagsPerAxis, LIMITS.tag),
    },
    gameyardUrl: '',
    visibility: input.visibility === 'public' ? 'public' : 'draft',
  }

  const hurdleText = requireText(input.hurdle?.text, 'つまずき', LIMITS.hurdleText, {
    allowEmpty: true,
  })
  if (hurdleText) {
    story.hurdle = {
      text: hurdleText,
      status: input.hurdle?.status === 'resolved' ? 'resolved' : 'open',
    }
  }

  const url = String(input.gameyardUrl ?? '').trim()
  if (url) {
    if (!url.startsWith(GAMEYARD_PREFIX)) {
      throw new StoryError('GAMEYARD の作品 URL（play-game-yard.com）だけを貼れます。')
    }
    story.gameyardUrl = url
  }

  return story
}

export class Stories {
  #dir

  constructor({ dir, now = () => Date.now() }) {
    this.#dir = dir
    this.now = now
    fs.mkdirSync(dir, { recursive: true })
  }

  #file(id) {
    // id はこのモジュールが生成した hex だけを受ける。パス操作は起きない
    if (!/^[a-f0-9]{16}$/.test(String(id ?? ''))) return null
    return path.join(this.#dir, `${id}.json`)
  }

  #read(id) {
    const file = this.#file(id)
    if (!file) return null
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      return null
    }
  }

  #write(id, story, { create = false } = {}) {
    const file = this.#file(id)
    if (create) {
      fs.writeFileSync(file, JSON.stringify(story, null, 2), { flag: 'wx', mode: 0o600 })
      return
    }
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(story, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  create({ author, input }) {
    const story = {
      id: crypto.randomBytes(ID_BYTES).toString('hex'),
      authorId: author.id,
      authorHandle: author.handle,
      ...normalizeInput(input ?? {}),
      createdAt: new Date(this.now()).toISOString(),
      updatedAt: new Date(this.now()).toISOString(),
    }
    this.#write(story.id, story, { create: true })
    return story
  }

  /**
   * 更新は本人だけ。他人の下書きは「無い」と同じ扱い（404）にして、
   * 存在の有無から本人性を推測されないようにする。
   */
  update({ id, authorId, input }) {
    const current = this.#read(id)
    if (!current || current.authorId !== authorId) {
      throw new StoryError('Story が見つかりません。', 404)
    }
    const next = {
      ...current,
      ...normalizeInput(input ?? {}),
      id: current.id,
      authorId: current.authorId,
      authorHandle: current.authorHandle,
      createdAt: current.createdAt,
      updatedAt: new Date(this.now()).toISOString(),
    }
    this.#write(id, next)
    return next
  }

  /** 公開分は誰でも。下書きは本人だけ（他人には 404 相当の null）。 */
  getVisible(id, viewerId = null) {
    const story = this.#read(id)
    if (!story) return null
    if (story.visibility !== 'public' && story.authorId !== viewerId) return null
    return story
  }

  /**
   * 公開のみ・新着順。ページ送りは page（1 始まり）。author はハンドル、
   * tag は 2 軸を横断して絞る（軸を分けないのは designs 00:22 の決め）。
   */
  listPublic({ page = 1, perPage = 20, author = null, tag = null } = {}) {
    const wanted = tag ? normalizeTag(tag) : null
    const all = this.#readAll()
      .filter((story) => story.visibility === 'public')
      .filter((story) => !author || story.authorHandle === author)
      .filter(
        (story) =>
          !wanted ||
          (story.tags?.tool ?? []).includes(wanted) ||
          (story.tags?.topic ?? []).includes(wanted),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    const start = (Math.max(1, page) - 1) * perPage
    return {
      stories: all.slice(start, start + perPage),
      total: all.length,
      page: Math.max(1, page),
      perPage,
    }
  }

  /** 自分の Story（下書き含む・新しい順）。 */
  listMine(authorId) {
    return this.#readAll()
      .filter((story) => story.authorId === authorId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }

  /**
   * 公開 Story の既出タグ語彙（名前のみ・辞書順）。件数は持たない
   * （数字の競争面を作らない）。下書きだけに在るタグは含めない —
   * 下書きの中身を語彙経由で漏らさないため。
   */
  publicTagVocabulary() {
    const tool = new Set()
    const topic = new Set()
    for (const story of this.#readAll()) {
      if (story.visibility !== 'public') continue
      for (const tag of story.tags?.tool ?? []) tool.add(tag)
      for (const tag of story.tags?.topic ?? []) topic.add(tag)
    }
    return { tool: [...tool].sort(), topic: [...topic].sort() }
  }

  #readAll() {
    let names
    try {
      names = fs.readdirSync(this.#dir)
    } catch {
      return []
    }
    const stories = []
    for (const name of names) {
      if (!name.endsWith('.json') || name.endsWith('.tmp')) continue
      try {
        stories.push(JSON.parse(fs.readFileSync(path.join(this.#dir, name), 'utf8')))
      } catch {
        /* 壊れた 1 件で全体を止めない */
      }
    }
    return stories
  }
}

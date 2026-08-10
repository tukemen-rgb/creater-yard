/**
 * Creator Story のレコード置き場。
 *
 * Story ＝ 制作の記録。時系列の短い記事で、書けるのは本人だけ。
 * SPEC §1 の範囲だけを持つ: タイトル・本文（プレーンテキスト）・
 * 使ったツール欄・つまずきタグ（ツール×トピックの 2 軸）・
 * GAMEYARD 作品への手動リンク・公開/下書き。
 *
 * 1 件 1 JSON にしているのは GAMEYARD の store と同じ理由 — 件数が
 * 少ないうちは索引を持たずに済み、壊れたときに 1 件だけ捨てれば復旧
 * できる。件数が増えたら SQLite などへ移す前提で、読み書きはこの
 * クラスに閉じている（規模が来たら考える。来ることが先 — SPEC §3）。
 *
 * 意図して持たないもの:
 *   - 閲覧数・いいね等のカウンタ（数字を競争にしない — 文化 §2）
 *   - 感想・コメント（初期は書き手が主役 — SPEC §1）
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

export const STORY_LIMITS = {
  titleMax: 80,
  /** 公開時の本文の下限。下書きは 0 でよい（書きかけを保存できること）。 */
  bodyMinPublic: 10,
  bodyMax: 8000,
  tools: 10,
  toolMax: 40,
  tagsPerAxis: 5,
  tagMax: 24,
  gameUrlMax: 300,
  /** つまずき欄の本文。SPEC §1 の「短文」。緩めるのは人の判断（CLAUDE.md）。 */
  hurdleMax: 200,
  /** 1 人あたりの保持件数。書き潰しでディスクを埋められないための上限。 */
  maxPerAuthor: 500,
  perPage: 20,
}

/** Story を貼れる先。GAMEYARD の作品 URL だけ（自動連携は後 — SPEC §1）。 */
const GAME_URL_HOSTS = new Set(['play-game-yard.com', 'www.play-game-yard.com'])

const ID_RE = /^[A-Za-z0-9_-]{8}$/

/**
 * 制御文字と双方向制御文字を落とす（GAMEYARD store の cleanText と同じ）。
 * 双方向制御文字は表示上の文字順を逆にできるため、「無害に見える文言」を
 * 作るのに使われる。改行とタブは本文で必要なので残す。
 */
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
 * つまずき欄（SPEC.md §1）。任意の短文＋未解決/解決の状態を持てる。
 *
 * レコード直下の `status`（公開状態）と名前がぶつかるので、**入れ子のまま**扱う。
 * 平坦化すると「解決にした」つもりが「公開にした」になりかねない。
 *
 * 本文が空なら `null` を返す。PUT は置き換えなので、空で送れば消える。
 * 解決数の公開カウンタは作らない（SPEC の但し書き）。
 */
function normalizeHurdle(value) {
  const text = cleanText(value?.text, STORY_LIMITS.hurdleMax)
  if (!text) return null
  return { text, status: value?.status === 'resolved' ? 'resolved' : 'open' }
}

/**
 * タグの正規化。NFKC で全角半角を揃え、英字は小文字に落とす。
 * 「Unity」「ｕｎｉｔｙ」「unity」が別のタグに割れると、検索の面
 * （ACQUISITION A1）が薄まる。
 */
function normalizeTag(value) {
  return cleanText(value, STORY_LIMITS.tagMax * 4)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, STORY_LIMITS.tagMax)
}

function normalizeTags(list, label) {
  if (list == null) return []
  if (!Array.isArray(list)) throw new StoryError(`${label}はリストで指定してください。`)
  const seen = new Set()
  const out = []
  for (const item of list) {
    const tag = normalizeTag(item)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= STORY_LIMITS.tagsPerAxis) break
  }
  return out
}

/**
 * 新しい Story を起点に、各作者の最新 1 件を一巡してから 2 件目へ進む。
 * 閲覧数ランキングや運営推薦を持たず、少数の投稿でも 1 人が一覧の先頭を
 * 占有しないための決定的な並び順。作者内の新着順は変えない。
 */
function interleaveAuthors(records) {
  const queues = new Map()
  for (const record of records) {
    const queue = queues.get(record.authorHandle) ?? []
    queue.push(record)
    queues.set(record.authorHandle, queue)
  }
  const mixed = []
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

function normalizeTools(list) {
  if (list == null) return []
  if (!Array.isArray(list)) throw new StoryError('使ったツールはリストで指定してください。')
  const seen = new Set()
  const out = []
  for (const item of list) {
    const tool = cleanText(item, STORY_LIMITS.toolMax)
    if (!tool || seen.has(tool)) continue
    seen.add(tool)
    out.push(tool)
    if (out.length >= STORY_LIMITS.tools) break
  }
  return out
}

/**
 * GAMEYARD 作品リンクの検査。
 *
 * 任意の URL を許すと、Story がリンク置き場（スパムの的）になる。
 * MVP は「自分の作品ページへの手動リンク」だけなので、貼れる先も
 * GAMEYARD だけに絞る。外部決済リンク等を持つ話（D-CY4）は Story 本文
 * ではなくプロフィール側の設計になってから考える。
 */
function normalizeGameUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.length > STORY_LIMITS.gameUrlMax) {
    throw new StoryError(`作品リンクは${STORY_LIMITS.gameUrlMax}文字以内にしてください。`)
  }
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new StoryError('作品リンクが URL として読めません。')
  }
  if (url.protocol !== 'https:' || !GAME_URL_HOSTS.has(url.hostname)) {
    throw new StoryError(
      '作品リンクに貼れるのは GAMEYARD（https://play-game-yard.com/…）の URL だけです。',
    )
  }
  return url.href
}

export class StoryStore {
  #dir

  constructor({ dir, now = () => Date.now() }) {
    this.#dir = dir
    this.now = now
    fs.mkdirSync(dir, { recursive: true })
  }

  #file(id) {
    if (!ID_RE.test(id)) throw new StoryError('Story の ID が正しくありません。', 404)
    return path.join(this.#dir, `${id}.json`)
  }

  #write(record) {
    const file = this.#file(record.id)
    const tmp = `${file}.tmp`
    // 書き途中で落ちると Story が読めなくなる。別名に書いてから置き換える。
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2))
    fs.renameSync(tmp, file)
  }

  /** 生のレコード。呼び出し側は公開判定（本人か public か）をしてから返すこと。 */
  get(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return null
    try {
      return JSON.parse(fs.readFileSync(this.#file(id), 'utf8'))
    } catch {
      return null
    }
  }

  /** 全件を読む。壊れた 1 件で全体を止めない。 */
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

  /**
   * 入力の検査と整形。作成・更新で同じものを通す。
   * 公開（status=public）は本文の下限を要求し、下書きは書きかけを許す。
   */
  #validate(input) {
    const status = input.status === 'draft' ? 'draft' : 'public'
    const title = cleanText(input.title, STORY_LIMITS.titleMax)
    if (!title) throw new StoryError('タイトルを入れてください。')
    const body = cleanText(input.body, STORY_LIMITS.bodyMax)
    if (status === 'public' && body.length < STORY_LIMITS.bodyMinPublic) {
      throw new StoryError(
        `公開する本文は${STORY_LIMITS.bodyMinPublic}文字以上にしてください（下書き保存なら短くても構いません）。`,
      )
    }
    return {
      status,
      title,
      body,
      tools: normalizeTools(input.tools),
      toolTags: normalizeTags(input.toolTags, 'ツールタグ'),
      topicTags: normalizeTags(input.topicTags, 'つまずき・トピックタグ'),
      gameUrl: normalizeGameUrl(input.gameUrl),
      hurdle: normalizeHurdle(input.hurdle),
    }
  }

  /**
   * @param {object} [options]
   * @param {object|null} [options.image] 添付画像 {id, ext, width, height}。
   *   検査と所有者の確認は API 層（images.mjs）が済ませてから渡す。
   *   Story ストアは形しか見ない（画像の実体はここの管轄外のため）。
   */
  create(account, input, { image = null } = {}) {
    const mine = this.listByAuthor(account.id)
    if (mine.length >= STORY_LIMITS.maxPerAuthor) {
      throw new StoryError(
        `1 アカウントで保存できる Story は ${STORY_LIMITS.maxPerAuthor} 件までです。`,
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
      image,
      createdAt: nowIso,
      updatedAt: nowIso,
      publishedAt: fields.status === 'public' ? nowIso : null,
    }
    // 万一 ID が衝突しても上書きしない（排他作成）。呼び直せば別 ID になる。
    fs.writeFileSync(this.#file(record.id), JSON.stringify(record, null, 2), { flag: 'wx' })
    return record
  }

  /**
   * @param {object} [options]
   * @param {object|null|undefined} [options.image] undefined なら現状維持、
   *   null なら外す、オブジェクトなら差し替え（検査済みのものだけ渡すこと）。
   */
  update(id, account, input, { image } = {}) {
    const record = this.get(id)
    if (!record) throw new StoryError('Story が見つかりません。', 404)
    if (record.authorId !== account.id) {
      throw new StoryError('この Story を編集できるのは本人だけです。', 403)
    }
    const fields = this.#validate(input)
    const nowIso = new Date(this.now()).toISOString()
    const next = {
      ...record,
      ...fields,
      image: image === undefined ? (record.image ?? null) : image,
      updatedAt: nowIso,
      // 最初に公開した時刻を保つ。公開→下書き→再公開で時系列が飛ばないように。
      publishedAt: fields.status === 'public' ? (record.publishedAt ?? nowIso) : record.publishedAt,
    }
    this.#write(next)
    return next
  }

  remove(id, account) {
    const record = this.get(id)
    if (!record) throw new StoryError('Story が見つかりません。', 404)
    if (record.authorId !== account.id) {
      throw new StoryError('この Story を消せるのは本人だけです。', 403)
    }
    fs.rmSync(this.#file(id), { force: true })
    return record
  }

  /** 退会時に全部消す。記録は本人のもの（文化 §3）。 */
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

  /**
   * 公開分の一覧。新着を起点に作者を一巡させる。
   * tool / topic / handle で絞り込める。ページ送りは 1 始まり。
   */
  listPublic({ page = 1, tool = '', topic = '', handle = '' } = {}) {
    const toolTag = normalizeTag(tool)
    const topicTag = normalizeTag(topic)
    const byHandle = String(handle ?? '').trim()
    let records = this.#readAll().filter((r) => r.status === 'public')
    if (toolTag) records = records.filter((r) => (r.toolTags ?? []).includes(toolTag))
    if (topicTag) records = records.filter((r) => (r.topicTags ?? []).includes(topicTag))
    if (byHandle) records = records.filter((r) => r.authorHandle === byHandle)
    records.sort(
      (a, b) =>
        String(b.publishedAt).localeCompare(String(a.publishedAt)) || String(a.id).localeCompare(String(b.id)),
    )
    records = interleaveAuthors(records)

    const perPage = STORY_LIMITS.perPage
    const totalPages = Math.max(1, Math.ceil(records.length / perPage))
    const current = Math.min(Math.max(1, Number(page) || 1), totalPages)
    return {
      stories: records
        .slice((current - 1) * perPage, current * perPage)
        .map((r) => publicStory(r)),
      total: records.length,
      page: current,
      totalPages,
    }
  }

  /**
   * sitemap 用の最小索引。公開分の ID・書き手・日付だけを返す。
   * 本文まで持ち出すと、sitemap を引くたびに全文をメモリへ載せることになる。
   */
  /**
   * フィード用。公開分を**初回公開日時の新しい順**で最大 limit 件返す。
   *
   * `listPublic` を使わないのは、あちらが作者輪番＋ページ送りだから。
   * フィードは「新着を知る」ためのもので、輪番もページも要らない。
   * 順位づけ・件数・閲覧数は使わない（新しい順だけ）。
   */
  latestPublic({ limit = 30, handle = '' } = {}) {
    const byHandle = String(handle ?? '').trim()
    return this.#readAll()
      .filter((r) => r.status === 'public' && r.publishedAt)
      .filter((r) => !byHandle || r.authorHandle === byHandle)
      .sort(
        (a, b) =>
          String(b.publishedAt).localeCompare(String(a.publishedAt)) ||
          String(a.id).localeCompare(String(b.id)),
      )
      .slice(0, limit)
      .map((r) => publicStory(r))
  }

  publicIndex() {
    return this.#readAll()
      .filter((r) => r.status === 'public')
      .map((r) => ({
        id: r.id,
        authorHandle: r.authorHandle,
        updatedAt: r.updatedAt,
        publishedAt: r.publishedAt,
      }))
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  }

  /**
   * タグ索引。公開 Story に付いたタグと件数（サイト全体の合計）。
   * 件数は「どの面が育っているか」を示す合計値で、人を並べる数字ではない
   * （個人単位の計測はしない — 文化 §5）。
   */
  tagIndex() {
    const tools = new Map()
    const topics = new Map()
    for (const record of this.#readAll()) {
      if (record.status !== 'public') continue
      for (const tag of record.toolTags ?? []) tools.set(tag, (tools.get(tag) ?? 0) + 1)
      for (const tag of record.topicTags ?? []) topics.set(tag, (topics.get(tag) ?? 0) + 1)
    }
    const toSorted = (map) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag, count]) => ({ tag, count }))
    return { tools: toSorted(tools), topics: toSorted(topics) }
  }
}

/** 外に出す形。authorId（内部 ID）は出さない。 */
export function publicStory(record) {
  return {
    id: record.id,
    authorHandle: record.authorHandle,
    title: record.title,
    body: record.body,
    tools: record.tools ?? [],
    toolTags: record.toolTags ?? [],
    topicTags: record.topicTags ?? [],
    gameUrl: record.gameUrl ?? '',
    image: record.image ?? null,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
  }
}

/** Open Graph、canonical、RSS discovery に使う URL と説明文の共通部品。 */

const DESCRIPTION_FALLBACK_LIMIT = 200

/** 本文の最初の一文を OGP 用の説明にする。句点がなければ最大 200 文字。 */
export function ogDescription(body: string): string {
  const oneLine = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const end = oneLine.indexOf('。')
  const sentence = end === -1 ? oneLine : oneLine.slice(0, end + 1)
  if (sentence.length <= DESCRIPTION_FALLBACK_LIMIT) return sentence
  return `${sentence.slice(0, DESCRIPTION_FALLBACK_LIMIT)}…`
}

/** ページ固有の openGraph と結合する共通項目。type はページごとに指定する。 */
export const SITE_OG = {
  siteName: 'CreatorYard',
  locale: 'ja_JP',
} as const

/** nginx の既存 /api/ 経路でそのまま配信できる全体 RSS。 */
/**
 * ページ 1 枚ぶんの Open Graph の土台（設計 A・2026-08-19 10:30）。
 *
 * **`SITE_OG` の展開を、呼ぶ側から取り上げるためだけに在る。**
 * Next.js の metadata は浅くマージするので、子が `openGraph` を書くと
 * 親の入れ子はまとめて置き換わる。展開を忘れると `og:site_name` と
 * `og:locale` が黙って消える —— `app/layout.common.tsx` の註釈が名指しで
 * 警告しているが、**それでもこの repo で 2 回踏んでいる。**
 * 註釈で守れなかったものは、形で守る。
 *
 * 正規 URL が作れないとき（`CY_SITE_ORIGIN` 未設定）は **`url` をキーごと
 * 出さない。**`undefined` を入れると焼く側が拾って空の値になりうる。
 * **無い URL を指すより、出さないほうがまし**（2026-08-09 に `og:image` で
 * 決めたのと同じ理屈）。
 */
export function ogWithUrl(canonical: string | null, type: 'website' | 'article' | 'profile') {
  return { ...SITE_OG, type, ...(canonical ? { url: canonical } : {}) }
}

export const SITE_FEED = '/api/feeds/stories.xml'

/** RSS discovery を保ったまま、設定済みの場合だけ canonical を加える。 */
export function alternatesFor(canonical: string | null, feed: string = SITE_FEED) {
  return {
    types: { 'application/rss+xml': feed },
    ...(canonical ? { canonical } : {}),
  }
}

/** 作者別 RSS。 */
export function handleFeedPath(handle: string): string {
  return `/api/feeds/creators/${handle}.xml`
}

/** 日本語やスラッシュを含むタグを一つの path segment に閉じ込める。 */
export function tagUrl(tag: string): string | null {
  return absoluteUrl(`/tags/${encodeURIComponent(tag)}/`)
}

/**
 * タグで絞った Story 一覧の正規 URL。
 *
 * クエリの順序やタグの表記揺れだけが違う URL は**同じ中身**になるので、
 * **1 本に正規化して canonical に出す**。一方、ページ送りは各ページの
 * Story が異なるため、2 ページ目以降は `page` を残す。
 *
 * `tool` と `topic` は一覧側で AND 絞り込みされるため、両方あれば両方を
 * canonical に残す。順序は常に tool → topic → page とする。
 *
 * **タグ長の上限（`STORY_LIMITS.tagMax` = 24）を超える値には canonical を
 * 出さない。**保存できないタグなので結果は必ず 0 件で、長い文字列を
 * `<head>` に載せる意味がない（`<head>` を膨らませる入口にしない）。
 * サーバー側の定数を直接は読めないので、**ここに写している。
 * 上限を変えるときは両方**（`server/lib/stories.mjs` の `STORY_LIMITS.tagMax`）。
 */
const CANONICAL_TAG_MAX = 24

export function storiesFilterUrl(tool?: string, topic?: string, page?: string): string | null {
  const origin = siteOrigin()
  if (!origin) return null
  // 一覧の照合規則（NFKC・小文字・前後空白除去）と同じ形にする。
  const toolTag = String(tool ?? '').normalize('NFKC').toLowerCase().trim()
  const topicTag = String(topic ?? '').normalize('NFKC').toLowerCase().trim()
  if (toolTag.length > CANONICAL_TAG_MAX || topicTag.length > CANONICAL_TAG_MAX) return null

  const params = new URLSearchParams()
  if (toolTag) params.set('tool', toolTag)
  if (topicTag) params.set('topic', topicTag)
  const pageNumber = Math.floor(Number(page))
  if (Number.isFinite(pageNumber) && pageNumber > 1) params.set('page', String(pageNumber))

  const query = params.toString()
  return `${origin}/stories/${query ? `?${query}` : ''}`
}

/**
 * 一覧の中で使う相対リンク（ページ送りなど）。**絞り込み条件を落とさない。**
 *
 * 以前は `tool ? … : topic ? …` の三項演算子で片方しか残さず、
 * `?tool=Godot&topic=影` で「次へ」を押すと **AND 条件の topic が黙って
 * 消えていた**（gdp が 2026-08-14 に検出）。canonical（storiesFilterUrl）と
 * 同じ tool → topic → page の順で、**両方を保持**する。
 *
 * canonical と違い、**値は正規化しない**（利用者が打った表記のまま運ぶ。
 * 照合は一覧側が正規化するので結果は同じ。正規化した URL へ勝手に
 * 書き換えると、戻るボタンの履歴が汚れる）。origin も付けない
 * （サイト内の遷移リンクなので、環境に依存させない）。
 */
export function storiesListPath(tool?: string, topic?: string, page?: number): string {
  const params = new URLSearchParams()
  if (tool?.trim()) params.set('tool', tool)
  if (topic?.trim()) params.set('topic', topic)
  if (Number.isFinite(page) && (page as number) > 1) params.set('page', String(page))
  const query = params.toString()
  return `/stories/${query ? `?${query}` : ''}`
}

/** 作者ページの正規 URL。 */
export function handleUrl(handle: string): string | null {
  return absoluteUrl(`/creators/${handle}/`)
}

/** Story ページの正規 URL。 */
export function storyUrl(id: string): string | null {
  return absoluteUrl(`/story/${id}/`)
}

/** sitemap など、末尾スラッシュを付けないファイル URL。 */
export function fileUrl(path: string): string | null {
  const origin = siteOrigin()
  if (!origin) return null
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

/** CY_SITE_ORIGIN は未設定時に仮 URL へフォールバックしない。 */
function siteOrigin(): string {
  return (process.env.CY_SITE_ORIGIN ?? '').trim().replace(/\/+$/, '')
}

/** ページ用の絶対 URL。trailingSlash 設定に合わせて末尾を / に統一する。 */
export function absoluteUrl(path: string): string | null {
  const origin = siteOrigin()
  if (!origin) return null
  const tail = path.startsWith('/') ? path : `/${path}`
  return `${origin}${tail.endsWith('/') ? tail : `${tail}/`}`
}

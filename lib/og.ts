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

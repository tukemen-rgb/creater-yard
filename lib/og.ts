/**
 * OGP に出す文字列の作り方（designs 2026-08-09 22:33 A-2）。
 *
 * `generateMetadata` の中に直接書くと単体試験が書けないので、関数に切る。
 * 出典は case-studies.md の事例 36（Open Graph 仕様と Meta の webmasters
 * 文書。どちらも 2026-08-09 確認）。
 */

/**
 * `og:description` に出す一文。
 *
 * 仕様は「A one to two sentence description」（1〜2 文）、Meta の推奨は
 * 「usually between 2 and 4 sentences」（2〜4 文）で**食い違っている**。
 * どちらも文字数は書いていないので、**文で切る**（数字で決め打ちしない）。
 *
 * 200 という数は**根拠のある値ではない**。句点が一つも無い本文が
 * そのまま出るのを防ぐためにこちらで置いた保険で、
 * **「仕様がそう言っている」ではない**。
 */
const DESCRIPTION_FALLBACK_LIMIT = 200

export function ogDescription(body: string): string {
  const oneLine = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const end = oneLine.indexOf('。')
  const sentence = end === -1 ? oneLine : oneLine.slice(0, end + 1)
  if (sentence.length <= DESCRIPTION_FALLBACK_LIMIT) return sentence
  return `${sentence.slice(0, DESCRIPTION_FALLBACK_LIMIT)}…`
}

/**
 * `og:url` の組み立て。
 *
 * 仕様が「恒久的な ID として使われる」と書いている項目なので、
 * **一つの形に統一する**。このサイトは `trailingSlash: true` なので
 * 実体が `/s/<id>/` にあり、**末尾スラッシュ有り**に寄せる。
 *
 * `SITE_ORIGIN` が未設定なら null。**それらしい嘘の URL を焼くより、
 * 出ないほうが直しやすい**（既定値を置かないのは designs 22:33 の決め）。
 */
/**
 * タグページの URL。**encode はここ 1 か所でやる**（designs 00:34）。
 *
 * タグには日本語が入る（「当たり判定」など）。生のまま組み立てると
 * `og:url` と canonical に生の UTF-8 が乗る。呼ぶ側が encode を
 * 忘れる余地を残さないよう、タグを受け取る口を分けた。
 *
 * `encodeURIComponent` は `/` も `%2F` にするので、`/` を含むタグが
 * 経路を割ることもない。
 */
export function tagUrl(tag: string): string | null {
  return absoluteUrl(`/tags/${encodeURIComponent(tag)}/`)
}

export function absoluteUrl(path: string): string | null {
  const origin = (process.env.SITE_ORIGIN ?? '').trim().replace(/\/+$/, '')
  if (!origin) return null
  const tail = path.startsWith('/') ? path : `/${path}`
  return `${origin}${tail.endsWith('/') ? tail : `${tail}/`}`
}

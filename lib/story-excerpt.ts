/**
 * 一覧に出すときだけ、**行まるごとの見出しを頭から飛ばす**（U-17）。
 *
 * ヒアリングから書いた本文は必ず `【つくっているもの】` で始まるので、
 * **抜粋の頭が全部同じ語**になる。一覧で見られているのは頭の 2 語ほど
 * （事例 88・NN/g）なので、そこが定型で埋まると何の記録か分からない。
 *
 * **本文そのものは書き換えない。**見出しは書いた本人の目印で、
 * Story の面では `white-space: pre-wrap` のまま読みやすく出る。
 *
 * - 飛ばすのは**行まるごとが `【…】` のとき**だけ（`【重要】ここが肝` は壊さない）
 * - **先頭 5 行まで**しか見ない（見出しだけが続く本文で、末尾から始めない）
 * - 全部が見出しなら、元の本文から作る（空の抜粋を出さない）
 *
 * **`server/lib/feed.mjs` にも同じ規則がある。**あちらは素の `.mjs` で、
 * ここは Next が束ねる TS なので**輸入し合えない** —— 本番の API に
 * 型剥がしの読み込みを持ち込むのは、直したい問題より重い。
 * **同じであることは `server/story-excerpt.test.mjs` が振る舞いで突き合わせる。**
 */
const HEADING_LINE = /^【[^】]*】$/
const HEADING_SCAN_LINES = 5

export function excerptSource(body: string): string {
  const lines = body.split('\n')
  let at = 0
  while (at < lines.length && at < HEADING_SCAN_LINES && HEADING_LINE.test(lines[at].trim())) {
    at += 1
  }
  const rest = lines.slice(at).join('\n').trim()
  return rest || body
}

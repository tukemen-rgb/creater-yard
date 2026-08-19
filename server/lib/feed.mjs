/**
 * RSS 2.0 の生成。依存を増やさず自前で組む（GAMEYARD の feed と同じ方針）。
 *
 * 守る要件（rssboard.org の仕様で確認したもの）:
 *   - channel は title / link / description の 3 つ必須
 *   - item は title＋link＋pubDate（RFC 822 系。Date#toUTCString で足りる）
 *
 * サイトのオリジンは `CY_SITE_ORIGIN` で受ける。**既定値は置かない。**
 * 未設定のとき `http://localhost:3000` を既定にしていた時期があったが外した。
 * **RSS の URL は購読の永続契約**で、設定を入れ忘れたまま配ると
 * **購読者の手元に localhost の URL が永久に残る**。読み手からは直せない。
 * 空文字なら api.mjs が 503 を返し、**フィードを配らない**。
 *
 * 日付は **`publishedAt`（初回公開日時）**を使う。`createdAt` は使わない。
 * 下書きとして書き始めた日を外に出さないため。
 */

/**
 * 読み込み時の定数ではなく**呼ぶたびに読む**。定数にすると、環境変数を
 * 後から差し替えた場合（試験・起動順の違い）に効かない。
 */
export function siteOrigin() {
  return (process.env.CY_SITE_ORIGIN ?? '').trim().replace(/\/+$/, '')
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * つまずきの見出し（設計 I-12）。**状態の言い方はカードと同じにする** ——
 * 面ごとに違う言葉を使わない（`components/story-card.tsx` と同じ語）。
 *
 * 出すのは**公開項目のつまずきだけ**。2026-08-10 に決めた feed の境界
 * （公開分のみ・閲覧の計測なし）は動かさない。**広げたのは「何を載せるか」
 * であって、「誰の何を載せるか」ではない。**
 */
function hurdleLine(hurdle) {
  const text = String(hurdle?.text ?? '').trim()
  if (!text) return ''
  const state = hurdle.status === 'resolved' ? '乗り越えた' : '悩み中'
  return `つまずき（${state}）: ${text}\n\n`
}

/** 本文の冒頭だけを description に使う。全文は載せない（ページへ来てもらう）。 */
function excerpt(body, max = 200) {
  const text = String(body ?? '')
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * @param {{title: string, link: string, description: string, stories: object[]}} input
 *
 * `publishedAt` が無いもの（＝下書き）は**入れない**。呼ぶ側で絞ってあるが、
 * ここでも落とす。フィードは外へ出る一方通行なので、二重に止める。
 */
export function buildStoriesFeed({ title, link, description, stories }) {
  const items = (stories ?? [])
    .filter((story) => story?.publishedAt)
    .map((story) => {
      const url = `${siteOrigin()}/story/${story.id}/`
      return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(story.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(`${hurdleLine(story.hurdle)}${excerpt(story.body)}`)}</description>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
${items}
  </channel>
</rss>
`
}

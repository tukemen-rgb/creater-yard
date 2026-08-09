/**
 * RSS 2.0 の生成（designs.md 2026-08-08 21:22 段階 C）。
 *
 * 依存を増やさず自前で組む（GAMEYARD の feed と同じ方針）。守る要件は
 * 事例 18（rssboard.org）で確認したもの:
 *   - channel は title / link / description の 3 つ必須
 *   - item は title＋link＋pubDate（RFC 822 系。Date#toUTCString で足りる）
 *
 * サイトのオリジンは SITE_ORIGIN 環境変数で受ける。**既定値は置かない。**
 *
 * 以前は未設定のとき `http://localhost:3000` にしていたが、外した
 * （designs 2026-08-10 02:33）。**RSS の URL は購読の永続契約**
 * （proposals 2026-08-08 21:12）なので、設定を入れ忘れたまま配ると
 * **購読者の手元に localhost の URL が永久に残る**。読み手の側からは
 * 直しようがない。空文字なら**フィードを配らない**（api.mjs が 503）。
 */

/**
 * 読み込み時の定数ではなく**呼ぶたびに読む**。定数にすると、
 * 環境変数を後から差し替えた場合（試験・起動順の違い）に効かない。
 * lib/og.ts の siteOrigin と同じ形にそろえてある。
 */
export function siteOrigin() {
  return (process.env.SITE_ORIGIN ?? '').trim().replace(/\/+$/, '')
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** 本文の冒頭だけを description に使う。全文は載せない（ページへ来てもらう）。 */
function excerpt(body, max = 200) {
  const text = String(body ?? '')
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function buildStoriesFeed({ title, link, description, stories }) {
  const items = stories
    .map(
      (story) => `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(`${siteOrigin()}/s/${story.id}/`)}</link>
      <guid isPermaLink="true">${escapeXml(`${siteOrigin()}/s/${story.id}/`)}</guid>
      <pubDate>${new Date(story.createdAt).toUTCString()}</pubDate>
      <description>${escapeXml(excerpt(story.body))}</description>
    </item>`,
    )
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

/**
 * RSS 2.0 の生成（designs.md 2026-08-08 21:22 段階 C）。
 *
 * 依存を増やさず自前で組む（GAMEYARD の feed と同じ方針）。守る要件は
 * 事例 18（rssboard.org）で確認したもの:
 *   - channel は title / link / description の 3 つ必須
 *   - item は title＋link＋pubDate（RFC 822 系。Date#toUTCString で足りる）
 *
 * サイトのオリジンはドメイン決定待ちのため SITE_ORIGIN 環境変数で受ける
 * （未設定はローカル確認用の値。本番は運用が設定する）。
 */

export const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '')

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
      <link>${escapeXml(`${SITE_ORIGIN}/s/${story.id}/`)}</link>
      <guid isPermaLink="true">${escapeXml(`${SITE_ORIGIN}/s/${story.id}/`)}</guid>
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

/**
 * 公開 Story を 1 件ずつ焼き込む（designs 2026-08-09 22:33 A-2）。
 *
 * **Server Component。**`generateMetadata` は Server Component でしか
 * 動かない（事例 35・Next.js 公式）ので、Story 固有の OGP を出すには
 * ここが Server である必要がある。'use client' を付けたら壊れる。
 *
 * 焼かれるのは**公開分だけ**。id を知っていても下書きは焼かれない
 * （A-1 の readPublicStory が viewerId 無しで getVisible を呼ぶため）。
 *
 * シェル（app/s/page.tsx）は消さない。焼き込みの後に増えた Story は
 * まだ静的ファイルが無く、nginx の try_files がシェルへ落とす。
 */
import type { Metadata } from 'next'

import { StoryView } from '../../../components/StoryView'
import { absoluteUrl, ogDescription } from '../../../lib/og'
import { readPublicStories, readPublicStory } from '../../../lib/stories-static'

/**
 * 公開 Story が 1 件も無いときの受け皿。
 *
 * `output: 'export'` は `generateStaticParams` が**空の配列を返すと
 * ビルドごと落ちる**（「missing generateStaticParams()」と言われる。
 * 2026-08-09 に実際に踏んで確かめた）。data/ を持たない機械
 * ＝ clone した直後や CI では公開 Story が 0 件なので、そのままだと
 * **誰も `npm run build` を通せない**。
 *
 * そこで 1 件だけ置き場所を作る。id は乱数 16 桁 hex なので、
 * すべて 0 の値が実在する Story とぶつかることは実質ない。
 * 中身は「見つかりません」— どこからもリンクしない。
 */
const PLACEHOLDER_ID = '0'.repeat(16)

export function generateStaticParams() {
  const ids = readPublicStories().map(({ id }) => ({ id }))
  return ids.length > 0 ? ids : [{ id: PLACEHOLDER_ID }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const story = readPublicStory(id)
  if (!story) return {}

  const description = ogDescription(story.body)
  const url = absoluteUrl(`/s/${story.id}/`)

  return {
    title: story.title,
    description,
    openGraph: {
      // 題名にサイト名を混ぜない（Meta の推奨）。ブランドは siteName が運ぶ
      title: story.title,
      description,
      siteName: 'CreatorYard',
      type: 'article',
      // SITE_ORIGIN が無いときは url を出さない（嘘の URL を焼かない）
      ...(url ? { url } : {}),
      // og:image は出さない。画像は未定（提案 25 は要判断）で、
      // 空文字や存在しない URL を焼くほうが悪い
    },
  }
}

export default async function BakedStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = readPublicStory(id)
  // 取れないのは受け皿（公開 0 件）のときだけ。シェルと同じ文言を出す
  if (!story) return <NotFound />
  return <StoryView story={story} />
}

function NotFound() {
  return (
    <div className="hero">
      <p className="eyebrow">Story</p>
      <h1>見つかりません</h1>
      <p className="hero__lede">
        この Story は存在しないか、下書きのままです。<a href="/stories/">新着一覧へ戻る</a>
      </p>
    </div>
  )
}

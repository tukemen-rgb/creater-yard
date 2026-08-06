import type { Metadata } from 'next'
import Link from 'next/link'

import { StoryCard } from '../../components/story-card'
import { Pager } from '../../components/pager'
import { publishedStories } from '../../lib/stories-read'

/**
 * 公開 Story の一覧（server モード）。リクエスト時に store を読んで
 * HTML を組み立てる。タグ絞り込み（?tool= / ?topic=）の結果ページが
 * そのまま検索の着地点になる（タグ SEO — ACQUISITION A1）。
 *
 * static モード用は page.static.tsx（ブラウザから API を読む版）。
 * 見出しや文言を変えるときは両方を直すこと。
 */
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ tool?: string; topic?: string; page?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tool, topic } = await searchParams
  const filter = tool || topic
  return {
    title: filter ? `「${filter}」の Story` : 'Creator Story',
    description: filter
      ? `「${filter}」に関する制作記録（Creator Story）の一覧。`
      : 'つくる過程の記録。作りかけ・つまずき・工夫、ぜんぶ主役。',
  }
}

export default async function StoriesPage({ searchParams }: Props) {
  const { tool = '', topic = '', page } = await searchParams
  const listing = publishedStories({ page: Number(page) || 1, tool, topic })

  const filterLabel = tool || topic
  const filterQuery = tool
    ? `tool=${encodeURIComponent(tool)}`
    : topic
      ? `topic=${encodeURIComponent(topic)}`
      : ''
  const pageHref = (n: number) => `/stories/?${filterQuery ? `${filterQuery}&` : ''}page=${n}`

  return (
    <div className="page">
      <h1>Creator Story</h1>
      <p className="page__lede">
        つくる過程の記録。作りかけ・つまずき・工夫、ぜんぶ主役。{' '}
        <Link prefetch={false} href="/tags/">タグから探す</Link>
      </p>
      {filterLabel && (
        <p className="notice">
          「{filterLabel}」で絞り込み中 — <Link prefetch={false} href="/stories/">解除する</Link>
        </p>
      )}
      {listing.stories.length === 0 && (
        <p className="notice">
          まだ Story がありません。
          <Link prefetch={false} href="/write/">最初の 1 本を書きませんか。</Link>
        </p>
      )}
      {listing.stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
      <Pager
        page={listing.page}
        totalPages={listing.totalPages}
        prevHref={pageHref(listing.page - 1)}
        nextHref={pageHref(listing.page + 1)}
      />
    </div>
  )
}

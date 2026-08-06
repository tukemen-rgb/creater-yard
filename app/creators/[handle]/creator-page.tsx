import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StoryCard } from '../../../components/story-card'
import { Pager } from '../../../components/pager'
import { creatorStories } from '../../../lib/stories-read'

/**
 * 書き手の実 URL（/creators/<handle>/）。その人の公開 Story が時系列で
 * 並ぶ（Timeline の原型）。
 *
 * 実在の判定は「公開 Story があるか」で行う。アカウントの存在は明かさない
 * — ハンドルの総当たり調査に使われるし、まだ何も書いていない人のページを
 * 出しても空の部屋を見せるだけになる。
 */
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/

type Props = {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  if (!HANDLE_RE.test(handle) || creatorStories(handle).total === 0) return {}
  return {
    title: `${handle} の記録`,
    description: `${handle} の制作記録（Creator Story）。`,
  }
}

export default async function CreatorPage({ params, searchParams }: Props) {
  const { handle } = await params
  const { page } = await searchParams
  if (!HANDLE_RE.test(handle)) notFound()
  const listing = creatorStories(handle, Number(page) || 1)
  if (listing.total === 0) notFound()

  return (
    <div className="page">
      <h1>{handle} の記録</h1>
      {listing.stories.map((story) => (
        <StoryCard key={story.id} story={story} showAuthor={false} />
      ))}
      <Pager
        page={listing.page}
        totalPages={listing.totalPages}
        prevHref={`/creators/${handle}/?page=${listing.page - 1}`}
        nextHref={`/creators/${handle}/?page=${listing.page + 1}`}
      />
    </div>
  )
}

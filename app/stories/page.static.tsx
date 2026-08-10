'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { api, ApiError, type StoryListing } from '../../lib/api'
import { StoryCard } from '../../components/story-card'

/**
 * 公開 Story の一覧（新着を起点に作者を一巡）。?tool= / ?topic= で絞り込み、?page= で送る。
 * 静的書き出しのため、一覧はブラウザから API を読む。
 */
function StoriesInner() {
  const params = useSearchParams()
  const tool = params.get('tool') ?? ''
  const topic = params.get('topic') ?? ''
  const page = params.get('page') ?? '1'

  const [listing, setListing] = useState<StoryListing | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = new URLSearchParams({ page })
    if (tool) query.set('tool', tool)
    if (topic) query.set('topic', topic)
    api<StoryListing>(`/api/stories.json?${query}`)
      .then(setListing)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [tool, topic, page])

  const filterLabel = tool || topic
  const filterQuery = tool ? `tool=${encodeURIComponent(tool)}` : topic ? `topic=${encodeURIComponent(topic)}` : ''

  return (
    <div className="page">
      <h1>Creator Story</h1>
      <p className="page__lede">
        つくる過程の記録。作りかけ・つまずき・工夫、ぜんぶ主役。
        {' '}
        <Link prefetch={false} href="/tags/">タグから探す</Link>
      </p>
      {filterLabel && (
        <p className="notice">
          「{filterLabel}」で絞り込み中 — <Link prefetch={false} href="/stories/">解除する</Link>
        </p>
      )}
      {error && <p className="notice notice--error">{error}</p>}
      {!error && !listing && <p className="notice">読み込み中…</p>}
      {listing && listing.stories.length === 0 && (
        <p className="notice">
          まだ Story がありません。
          <Link prefetch={false} href="/write/">最初の 1 本を書きませんか。</Link>
        </p>
      )}
      {listing?.stories.map((story) => <StoryCard key={story.id} story={story} />)}
      {/* server 版と同じ位置・同じ文言にそろえる（表示順の差異を作らない）。 */}
      {listing && listing.stories.length > 0 && (
        <p className="notice">
          新しい記録を基準に、同じ作者が続かないように並べています。閲覧数ランキングではありません。
        </p>
      )}
      {listing && listing.totalPages > 1 && (
        <nav className="pager" aria-label="ページ送り">
          {listing.page > 1 && (
            <Link prefetch={false} href={`/stories/?${filterQuery ? `${filterQuery}&` : ''}page=${listing.page - 1}`}>
              ← 前のページ
            </Link>
          )}
          <span className="pager__state">
            {listing.page} / {listing.totalPages}
          </span>
          {listing.page < listing.totalPages && (
            <Link prefetch={false} href={`/stories/?${filterQuery ? `${filterQuery}&` : ''}page=${listing.page + 1}`}>
              次のページ →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

export default function StoriesPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <StoriesInner />
    </Suspense>
  )
}

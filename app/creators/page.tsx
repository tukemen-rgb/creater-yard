'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { api, ApiError, type StoryListing } from '../../lib/api'
import { StoryCard } from '../../components/story-card'

/**
 * 書き手の個人ページ。その人の公開 Story が時系列で並ぶ（Timeline の原型）。
 * フォロワー数・投稿数の誇示はしない（数字を競争にしない）。
 */
function CreatorInner() {
  const params = useSearchParams()
  const handle = params.get('handle') ?? ''
  const page = params.get('page') ?? '1'

  const [listing, setListing] = useState<(StoryListing & { handle: string }) | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!handle) {
      setError('書き手が指定されていません。')
      return
    }
    api<StoryListing & { handle: string }>(`/api/creators/${encodeURIComponent(handle)}.json?page=${page}`)
      .then(setListing)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [handle, page])

  if (error) {
    return (
      <div className="page">
        <p className="notice notice--error">{error}</p>
      </div>
    )
  }
  if (!listing) return <p className="notice">読み込み中…</p>

  return (
    <div className="page">
      <h1>{listing.handle} の記録</h1>
      {listing.stories.length === 0 && (
        <p className="notice">公開されている Story はまだありません。</p>
      )}
      {listing.stories.map((story) => (
        <StoryCard key={story.id} story={story} showAuthor={false} />
      ))}
      {listing.totalPages > 1 && (
        <nav className="pager" aria-label="ページ送り">
          {listing.page > 1 && (
            <Link prefetch={false} href={`/creators/?handle=${handle}&page=${listing.page - 1}`}>
              ← 前のページ
            </Link>
          )}
          <span className="pager__state">
            {listing.page} / {listing.totalPages}
          </span>
          {listing.page < listing.totalPages && (
            <Link prefetch={false} href={`/creators/?handle=${handle}&page=${listing.page + 1}`}>
              次のページ →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

export default function CreatorPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <CreatorInner />
    </Suspense>
  )
}

'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { api, ApiError, formatDate, getHandle, type Story } from '../../lib/api'

/**
 * Story 1 本のページ。本文はプレーンテキスト（まず装飾なし — SPEC §1）。
 * 下書きは本人にだけ返る（API 側で 404 に揃えている）。
 */
function StoryInner() {
  const params = useSearchParams()
  const id = params.get('id') ?? ''

  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('Story が指定されていません。')
      return
    }
    // 下書きを本人が開けるよう、ログイン中はトークン付きで読む
    api<{ story: Story }>(`/api/stories/${id}.json`, { auth: Boolean(getHandle()) })
      .then((data) => setStory(data.story))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [id])

  if (error) {
    return (
      <div className="page">
        <p className="notice notice--error">{error}</p>
        <p>
          <Link prefetch={false} href="/stories/">← Story 一覧へ</Link>
        </p>
      </div>
    )
  }
  if (!story) return <p className="notice">読み込み中…</p>

  const mine = getHandle() === story.authorHandle
  return (
    <article className="page story">
      <p className="story__back">
        <Link prefetch={false} href="/stories/">← Story 一覧</Link>
      </p>
      <h1 className="story__title">
        {story.title}
        {story.status === 'draft' && <span className="badge badge--draft">下書き</span>}
      </h1>
      <p className="story__meta">
        <Link prefetch={false} href={`/creators/?handle=${story.authorHandle}`}>
          {story.authorHandle}
        </Link>
        {' ・ '}
        {formatDate(story.publishedAt ?? story.updatedAt)}
        {mine && (
          <>
            {' ・ '}
            <Link prefetch={false} href={`/write/?id=${story.id}`}>編集する</Link>
          </>
        )}
      </p>
      <div className="story__body">{story.body}</div>
      {story.tools.length > 0 && (
        <p className="story__tools">
          使ったツール: {story.tools.join(' / ')}
        </p>
      )}
      {(story.toolTags.length > 0 || story.topicTags.length > 0) && (
        <p className="story-card__tags">
          {story.toolTags.map((tag) => (
            <Link prefetch={false} key={`tool-${tag}`} className="tag" href={`/stories/?tool=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
          {story.topicTags.map((tag) => (
            <Link prefetch={false} key={`topic-${tag}`} className="tag tag--topic" href={`/stories/?topic=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
        </p>
      )}
      {story.gameUrl && (
        <p className="story__game">
          この記録の作品: <a href={story.gameUrl}>{story.gameUrl}</a>（GAMEYARD）
        </p>
      )}
    </article>
  )
}

export default function StoryPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <StoryInner />
    </Suspense>
  )
}

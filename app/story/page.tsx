'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { api, ApiError, getHandle, type Story } from '../../lib/api'
import { StoryArticle } from '../../components/story-article'

/**
 * 下書きプレビュー（/story/?id=）。本人トークン付きで API から読むので、
 * 下書きは本人にだけ見える。公開済みの ID を開いたら実 URL
 * （/story/<id>/。server モードが HTML で返す）へ送る — 同じ内容が
 * 2 つの URL に並ぶと検索側でどちらが本物か割れるため。
 */
function StoryInner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''

  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('Story が指定されていません。')
      return
    }
    api<{ story: Story }>(`/api/stories/${id}.json`, { auth: Boolean(getHandle()) })
      .then((data) => {
        if (data.story.status === 'public') {
          router.replace(`/story/${data.story.id}/`)
          return
        }
        setStory(data.story)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [id, router])

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
  return <StoryArticle story={story} />
}

export default function StoryPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <StoryInner />
    </Suspense>
  )
}

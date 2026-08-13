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
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    setStory(null)
    setError('')
    if (!id) {
      setError('Story が指定されていません。')
      return
    }
    let active = true
    api<{ story: Story }>(`/api/stories/${id}.json`, { auth: Boolean(getHandle()) })
      .then((data) => {
        if (!active) return
        if (data.story.status === 'public') {
          router.replace(`/story/${data.story.id}/`)
          return
        }
        setStory(data.story)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof ApiError ? err.message : '読み込めませんでした。')
      })
    return () => {
      active = false
    }
  }, [id, retryKey, router])

  if (error) {
    return (
      <div className="page">
        <p className="notice notice--error" role="alert">
          {error}{' '}
          {id && (
            <button type="button" className="linklike" onClick={() => setRetryKey((key) => key + 1)}>
              再読み込み
            </button>
          )}
        </p>
        <p>
          <Link prefetch={false} href="/account/">← 自分の Story 一覧へ</Link>
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

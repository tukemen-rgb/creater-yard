'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { StoryCard } from '../../components/story-card'
import { api, ApiError, type Story } from '../../lib/api'
import { savedStoryIds, saveStoryIds } from '../../lib/saved-stories'

export default function SavedStoriesPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const ids = savedStoryIds()
    Promise.all(
      ids.map(async (id) => {
        try {
          const { story } = await api<{ story: Story }>(`/api/stories/${id}.json`)
          return { id, story, missing: false, failed: false }
        } catch (error) {
          return {
            id,
            story: null,
            missing: error instanceof ApiError && error.status === 404,
            failed: !(error instanceof ApiError && error.status === 404),
          }
        }
      }),
    ).then((results) => {
      const missing = new Set(results.filter((result) => result.missing).map((result) => result.id))
      if (missing.size > 0) saveStoryIds(ids.filter((id) => !missing.has(id)))
      setStories(results.flatMap((result) => (result.story ? [result.story] : [])))
      setFailed(results.some((result) => result.failed))
      setReady(true)
    })
  }, [])

  return (
    <div className="page">
      <h1>保存した Story</h1>
      <p className="page__lede">
        この端末のブラウザに保存した Story です。保存情報は CreatorYard へ送信しません。
      </p>
      {!ready && <p className="notice">読み込み中…</p>}
      {ready && !failed && stories.length === 0 && (
        <p className="notice">
          保存した Story はありません。<Link prefetch={false} href="/stories/">Story を読む</Link>
        </p>
      )}
      {failed && (
        <div className="notice notice--error" role="alert">
          一部の Story を読み込めませんでした。保存は消さずに残しています。{' '}
          <button type="button" className="button button--ghost" onClick={() => window.location.reload()}>
            もう一度読み込む
          </button>
        </div>
      )}
      {stories.map((story) => <StoryCard key={story.id} story={story} />)}
    </div>
  )
}

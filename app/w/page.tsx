'use client'
/**
 * 書き手の個人ページ（Timeline の原型。designs.md 2026-08-08 21:22 段階 B）。
 *
 * 公開分だけを時系列で並べる。フォロワー数・投稿数の集計は出さない
 * （数字を競争にしない）。本番は nginx が /w/<handle>/ を rewrite、
 * 開発は /w/?handle=<handle> でも開ける（/s と同じ方式）。
 */
import { useEffect, useState } from 'react'

import { StoryTags } from '../../components/StoryTags'
import { isConfigured, WRITE_API_BASE, type Story } from '../../lib/write-api'

function handleFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const byQuery = new URLSearchParams(window.location.search).get('handle')
  if (byQuery) return byQuery
  const match = /^\/w\/([a-z0-9][a-z0-9_-]{2,31})\/?$/.exec(window.location.pathname)
  return match?.[1] ?? null
}

export default function WriterPage() {
  const [handle, setHandle] = useState<string | null>(null)
  const [stories, setStories] = useState<Story[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const who = handleFromLocation()
    setHandle(who)
    if (!who || !isConfigured()) {
      setError(true)
      return
    }
    fetch(`${WRITE_API_BASE}/api/stories.json?author=${encodeURIComponent(who)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => setStories(body.stories))
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="hero">
        <p className="eyebrow">書き手</p>
        <h1>見つかりません</h1>
        <p className="hero__lede">
          このページは存在しません。<a href="/stories/">新着一覧へ戻る</a>
        </p>
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">書き手</p>
      <h1>{handle} の制作記録</h1>
      <p className="hero__lede">新しい順に並びます。</p>
      {stories && stories.length === 0 && (
        <section className="plan">
          <p className="plan__note">公開された Story はまだありません。</p>
        </section>
      )}
      <ul className="story-list">
        {stories?.map((story) => (
          <li key={story.id} className="story-list__item">
            <h2>
              <a href={`/s/${story.id}/`}>{story.title}</a>
            </h2>
            <p className="story-list__meta">
              {new Date(story.createdAt).toLocaleDateString('ja-JP')}
              {story.hurdle && (
                <span className="story-list__hurdle">
                  つまずき: {story.hurdle.status === 'resolved' ? '解決' : '未解決'}
                </span>
              )}
            </p>
            <p className="story-list__excerpt">
              {story.body.length > 120 ? `${story.body.slice(0, 120)}…` : story.body}
            </p>
            <StoryTags story={story} />
          </li>
        ))}
      </ul>
    </div>
  )
}

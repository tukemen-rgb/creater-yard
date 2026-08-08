'use client'
/**
 * タグページ（designs.md 2026-08-09 00:22 段階 C）。
 *
 * URL は軸で分けない `/tags/<tag>/`（1 つの語でツール軸・トピック軸を横断）。
 * 静的シェル方式: 本番は nginx が rewrite、開発は /tags/?tag=<tag> でも開ける。
 * 並びは新着順のみ。件数・人気順は出さない（数字を競争にしない）。
 */
import { useEffect, useState } from 'react'

import { StoryTags } from '../../components/StoryTags'
import { isConfigured, WRITE_API_BASE, type Story } from '../../lib/write-api'

function tagFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const byQuery = new URLSearchParams(window.location.search).get('tag')
  if (byQuery) return byQuery
  const match = /^\/tags\/([^/]+)\/?$/.exec(window.location.pathname)
  return match ? decodeURIComponent(match[1]) : null
}

export default function TagPage() {
  const [tag, setTag] = useState<string | null>(null)
  const [stories, setStories] = useState<Story[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const wanted = tagFromLocation()
    setTag(wanted)
    if (!wanted || !isConfigured()) {
      setError(true)
      return
    }
    fetch(`${WRITE_API_BASE}/api/stories.json?tag=${encodeURIComponent(wanted)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => setStories(body.stories))
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="hero">
        <p className="eyebrow">タグ</p>
        <h1>見つかりません</h1>
        <p className="hero__lede">
          このタグページは開けませんでした。<a href="/stories/">新着一覧へ戻る</a>
        </p>
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">タグ</p>
      <h1>#{tag}</h1>
      <p className="hero__lede">
        このタグが付いた制作記録。新しい順に並びます。
      </p>
      {stories && stories.length === 0 && (
        <section className="plan">
          <p className="plan__note">
            このタグの公開 Story はまだありません。<a href="/write/">最初の 1 本</a>
            を書きませんか。
          </p>
        </section>
      )}
      <ul className="story-list">
        {stories?.map((story) => (
          <li key={story.id} className="story-list__item">
            <h2>
              <a href={`/s/${story.id}/`}>{story.title}</a>
            </h2>
            <p className="story-list__meta">
              <a href={`/w/${story.authorHandle}/`}>{story.authorHandle}</a> ・{' '}
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

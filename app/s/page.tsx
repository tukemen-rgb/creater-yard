'use client'
/**
 * Story 1 件の表示（designs.md 2026-08-08 21:22 段階 B）。
 *
 * 静的シェル方式: 本番は nginx が /s/<id>/ をこのページに rewrite し、
 * client 側で pathname から id を取る（docs/nginx.example.conf）。
 * 開発（next dev）は rewrite が無いので /s/?id=<id> でも開けるようにしてある。
 * 表示は React の既定エスケープに任せ、HTML を解釈しない。
 */
import { useEffect, useState } from 'react'

import { StoryView } from '../../components/StoryView'
import { isConfigured, WRITE_API_BASE, type Story } from '../../lib/write-api'

function storyIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const byQuery = new URLSearchParams(window.location.search).get('id')
  if (byQuery) return byQuery
  const match = /^\/s\/([a-f0-9]{16})\/?$/.exec(window.location.pathname)
  return match?.[1] ?? null
}

export default function StoryPage() {
  const [story, setStory] = useState<Story | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')

  useEffect(() => {
    const id = storyIdFromLocation()
    if (!id || !isConfigured()) {
      setState('notfound')
      return
    }
    fetch(`${WRITE_API_BASE}/api/stories/${id}.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        setStory(body.story)
        setState('ok')
      })
      .catch(() => setState('notfound'))
  }, [])

  if (state === 'loading') {
    return (
      <div className="hero">
        <p className="eyebrow">Story</p>
        <p className="hero__lede">読み込んでいます…</p>
      </div>
    )
  }

  if (state === 'notfound' || !story) {
    return (
      <div className="hero">
        <p className="eyebrow">Story</p>
        <h1>見つかりません</h1>
        <p className="hero__lede">
          この Story は存在しないか、下書きのままです。
          <a href="/stories/">新着一覧へ戻る</a>
        </p>
      </div>
    )
  }

  // 表示は焼き込む側と同じ部品を使う（designs 22:33）。ここで別に書くと、
  // 焼かれた Story と焼かれていない Story で見た目が違うことになる
  return <StoryView story={story} />
}

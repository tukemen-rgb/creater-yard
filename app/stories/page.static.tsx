'use client'

import Link from 'next/link'
import { SITE_FEED, storiesListPath } from '../../lib/og'
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
  const [retryCount, setRetryCount] = useState(0)
  // I-9: server 版と同じ 1 行。**分岐にだけ使い、画面には出さない**。
  // API から受け取った stories 配列から数えるので、新しい項目は要らない。
  const authorsOnPage = new Set((listing?.stories ?? []).map((s) => s.authorHandle)).size

  useEffect(() => {
    let active = true
    setListing(null)
    setError('')
    const query = new URLSearchParams({ page })
    if (tool) query.set('tool', tool)
    if (topic) query.set('topic', topic)
    api<StoryListing>(`/api/stories.json?${query}`)
      .then((data) => {
        if (active) setListing(data)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '読み込めませんでした。')
      })
    return () => {
      active = false
    }
  }, [tool, topic, page, retryCount])

  const filterLabel = tool || topic
  // ページ送りは絞り込み条件を落とさない（server 版と同じ規則。両方を保持）

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
      {error && (
        <div className="notice notice--error" role="alert">
          {error}{' '}
          <button type="button" className="button button--ghost" onClick={() => setRetryCount((count) => count + 1)}>
            もう一度読み込む
          </button>
        </div>
      )}
      {!error && !listing && <p className="notice">読み込み中…</p>}
      {listing && listing.stories.length === 0 && (
        <p className="notice">
          まだ Story がありません。
          <Link prefetch={false} href="/write/">最初の 1 本を書きませんか。</Link>
        </p>
      )}
      {listing?.stories.map((story) => <StoryCard key={story.id} story={story} />)}
      {/* server 版と同じ位置・同じ文言にそろえる（表示順の差異を作らない）。
          I-9: 前半（並べ方の説明）は書き手が 2 人以上のページでだけ出す。
          後半（文化の説明）は条件に入れない — 経営判断 2026-08-10 22:00。
          server 版（page.server.tsx）と同じ形を保つこと。
          server/sort-notice.test.mjs が 2 ファイルを回して確かめている。 */}
      {listing && listing.stories.length > 0 && (
        <p className="notice">
          {authorsOnPage > 1 && '新しい記録を基準に、同じ作者が続かないように並べています。'}
          閲覧数ランキングではありません。
        </p>
      )}
      {/* 全体 RSS への**見えるリンク**。head の autodiscovery だけで
          終わらせない（受入条件 2026-08-08 15:02）。購読に登録は要らない。
          URL は API の実体と同じにする — 広告した URL が 200 を返さないと、
          購読者の手元に死んだ URL が永久に残る。 */}
      <p className="notice">
        新着を追うなら{' '}
        <a href={SITE_FEED}>RSS で受け取れます</a>
        （登録は要りません）。
      </p>
      {listing && listing.totalPages > 1 && (
        <nav className="pager" aria-label="ページ送り">
          {listing.page > 1 && (
            <Link prefetch={false} href={storiesListPath(tool, topic, listing.page - 1)}>
              ← 前のページ
            </Link>
          )}
          <span className="pager__state">
            {listing.page} / {listing.totalPages}
          </span>
          {listing.page < listing.totalPages && (
            <Link prefetch={false} href={storiesListPath(tool, topic, listing.page + 1)}>
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

'use client'
/**
 * 公開 Story の新着一覧（designs.md 2026-08-08 21:22 段階 A）。
 *
 * 並びは新着順だけ。人気順・急上昇は作らない（数字を競争にしない決定）。
 * 静的シェル＋API fetch で配る。Story 個別ページへのリンクは段階 B で足す。
 */
import { useEffect, useState } from 'react'

import { isConfigured, listStories, type StoryList } from '../../lib/write-api'

export default function StoriesPage() {
  const [list, setList] = useState<StoryList | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConfigured()) return
    listStories(page)
      .then(setList)
      .catch((err) => setError(err instanceof Error ? err.message : '取得に失敗しました。'))
  }, [page])

  if (!isConfigured()) {
    return (
      <div className="hero">
        <p className="eyebrow">準備中</p>
        <h1>Story</h1>
        <p className="hero__lede">新着一覧はまだ準備中です。</p>
      </div>
    )
  }

  const lastPage = list ? Math.max(1, Math.ceil(list.total / list.perPage)) : 1

  return (
    <div className="hero">
      <p className="eyebrow">Story</p>
      <h1>新着の制作記録</h1>
      <p className="hero__lede">新しい順に並びます。順位や人気の表示はありません。</p>
      {error && <p className="auth-form__error">{error}</p>}
      {list && list.stories.length === 0 && (
        <section className="plan">
          <p className="plan__note">
            まだ Story がありません。<a href="/write/">最初の 1 本</a>
            が、この一覧の始まりになります。
          </p>
        </section>
      )}
      <ul className="story-list">
        {list?.stories.map((story) => (
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
            {story.tools && story.tools.length > 0 && (
              <p className="story-list__tools">使ったツール: {story.tools.join(' / ')}</p>
            )}
          </li>
        ))}
      </ul>
      {list && lastPage > 1 && (
        <div className="story-list__pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            前へ
          </button>
          <span>
            {page} / {lastPage}
          </span>
          <button type="button" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
            次へ
          </button>
        </div>
      )}
    </div>
  )
}

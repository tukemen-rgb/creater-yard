'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { api, ApiError, type TagIndex } from '../../lib/api'

/**
 * タグ索引。ツール軸とつまずき・トピック軸の 2 軸（SPEC §1）。
 * 件数はサイト全体の合計値で、検索流入の面がどこに育っているかを示す。
 */
export default function TagsPage() {
  const [index, setIndex] = useState<TagIndex | null>(null)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    setIndex(null)
    setError('')
    api<TagIndex>('/api/tags.json')
      .then((data) => {
        if (active) setIndex(data)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '読み込めませんでした。')
      })
    return () => {
      active = false
    }
  }, [retryCount])

  return (
    <div className="page">
      <h1>タグから探す</h1>
      <p className="page__lede">
        あなたの遠回りが、誰かの近道になる。ツール名と「どこでつまずいたか」で記録を引けます。
      </p>
      {error && (
        <div className="notice notice--error" role="alert">
          {error}{' '}
          <button type="button" className="button button--ghost" onClick={() => setRetryCount((count) => count + 1)}>
            もう一度読み込む
          </button>
        </div>
      )}
      {!error && !index && <p className="notice">読み込み中…</p>}
      {index && (
        <>
          <section className="tag-section">
            <h2>ツール</h2>
            {index.tools.length === 0 && <p className="notice">まだタグがありません。</p>}
            <p className="story-card__tags">
              {index.tools.map((tag) => (
                <Link prefetch={false} key={tag} className="tag" href={`/stories/?tool=${encodeURIComponent(tag)}`}>
                  {tag}
                </Link>
              ))}
            </p>
          </section>
          <section className="tag-section">
            <h2>つまずき・トピック</h2>
            {index.topics.length === 0 && <p className="notice">まだタグがありません。</p>}
            <p className="story-card__tags">
              {index.topics.map((tag) => (
                <Link prefetch={false} key={tag} className="tag tag--topic" href={`/stories/?topic=${encodeURIComponent(tag)}`}>
                  {tag}
                </Link>
              ))}
            </p>
          </section>
        </>
      )}
    </div>
  )
}

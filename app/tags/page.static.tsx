'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { api, ApiError, type TagIndex } from '../../lib/api'

/**
 * タグ索引（static モード）。ツール軸とつまずき・トピック軸の 2 軸（SPEC §1）。
 * server モード用は page.server.tsx。見出しや文言を変えるときは両方を直すこと。
 *
 * **数は出さない。**`/api/tags.json` が返すのは語彙（名前）だけで、
 * いくつ付いているかは持っていない（標準制約「公開カウンタを作らない」）。
 * 以前ここには「合計値で面の育ち方を示す」と書いてあったが、
 * **そういう画面はもともと無い**ので消した（2026-08-19）。
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
      {index && index.tools.length === 0 && index.topics.length === 0 && (
        // 両軸とも空のときだけ、節の外に出口を 1 つ置く（設計 U-5）。
        // 片側だけ空なら出さない —— もう片方に押せるものが並んでいるのに
        // 「まだ何も無い」と誘うのは、画面と食い違う。
        // 数はここで分けるためだけに使い、画面には出さない。
        <p className="notice">
          タグは Story に付けると増えます —{' '}
          <Link prefetch={false} href="/write/">
            最初の 1 本を書きませんか。
          </Link>
        </p>
      )}
      {index && (
        <>
          <section className="tag-section">
            <h2>ツール</h2>
            {index.tools.length === 0 && <p className="notice">まだありません。</p>}
            <p className="story-card__tags">
              {index.tools.map((tag) => (
                // 出すのは書き手が打った書き方、押した先の鍵は小文字のまま。
                // 混ぜると、既に配った絞り込みの URL が壊れる（設計 U-6）
                <Link prefetch={false} key={tag} className="tag" href={`/stories/?tool=${encodeURIComponent(tag)}`}>
                  {index.toolNames?.[tag] ?? tag}
                </Link>
              ))}
            </p>
          </section>
          <section className="tag-section">
            <h2>つまずき・トピック</h2>
            {index.topics.length === 0 && <p className="notice">まだありません。</p>}
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

'use client'
/**
 * 自分の Story 一覧（designs.md 2026-08-09 13:21 段階 A）。
 *
 * SPEC 実装順②で「保存する側」だけを作り、読み出す側を作っていなかった
 * ぶんの修繕（⑤ 2026-08-09 12:51 で決定済みの積み残しと認定）。
 *
 * 動的セグメントが無いので nginx の rewrite は要らない（/s・/w・/tags と違う点）。
 * 中身は必ずログイン付きの fetch で取る。焼き込み（公開運用設計 段階 A）の
 * 対象にはしない — 誰の分でもない空の殻なので sitemap にも出さない。
 * 件数は出さない（数字を競争にしない）。
 */
import { useEffect, useState } from 'react'

import { StoryTags } from '../../components/StoryTags'
import { isConfigured, listMine, type Story } from '../../lib/write-api'

/**
 * 「続きを書く」（/write/?id=<id>）は編集モード＝段階 B のもの。
 * 段階 A の時点で出すと、id を無視した白紙の新規フォームに着く壊れたリンクに
 * なるので、**段階 B と同時に足す**。ここでは「在ることが見える」までを担う。
 */
function StoryRow({ story }: { story: Story }) {
  return (
    <li className="story-list__item">
      <h3>{story.title}</h3>
      <p className="story-list__meta">
        最終更新 {new Date(story.updatedAt).toLocaleDateString('ja-JP')}
        {story.visibility === 'public' && (
          <>
            {' ・ '}
            <a href={`/s/${story.id}/`}>公開ページ</a>
          </>
        )}
      </p>
      <StoryTags story={story} />
    </li>
  )
}

export default function MinePage() {
  const [stories, setStories] = useState<Story[] | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'guest' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConfigured()) {
      setState('error')
      setError('書く機能はまだ準備中です。')
      return
    }
    listMine()
      .then((list) => {
        setStories(list)
        setState('ok')
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '取得に失敗しました。'
        // ログインが必要なだけの場合と、それ以外の失敗を分けて伝える
        if (message.includes('ログイン')) {
          setState('guest')
          return
        }
        setError(message)
        setState('error')
      })
  }, [])

  if (state === 'guest') {
    return (
      <div className="hero">
        <p className="eyebrow">自分の記録</p>
        <h1>ログインが必要です</h1>
        <p className="hero__lede">
          <a href="/login/">ログイン</a>するか、<a href="/register/">登録</a>
          してください。
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="hero">
        <p className="eyebrow">自分の記録</p>
        <h1>読み込めませんでした</h1>
        <p className="hero__lede">{error}</p>
      </div>
    )
  }

  const drafts = stories?.filter((s) => s.visibility !== 'public') ?? []
  const published = stories?.filter((s) => s.visibility === 'public') ?? []

  return (
    <div className="hero">
      <p className="eyebrow">自分の記録</p>
      <h1>書いたもの</h1>
      <p className="hero__lede">新しく直したものから並びます。</p>

      <section className="plan">
        <h2>下書き</h2>
        <p className="plan__note">
          下書きを開き直して直す画面は、いま作っている途中です。
        </p>
        {state === 'ok' && drafts.length === 0 && (
          <p className="plan__note">下書きはありません。</p>
        )}
        <ul className="story-list">
          {drafts.map((story) => (
            <StoryRow key={story.id} story={story} />
          ))}
        </ul>
      </section>

      <section className="plan">
        <h2>公開したもの</h2>
        {state === 'ok' && published.length === 0 && (
          <p className="plan__note">
            まだ公開した記録はありません。<a href="/write/">最初の 1 本</a>を書けます。
          </p>
        )}
        <ul className="story-list">
          {published.map((story) => (
            <StoryRow key={story.id} story={story} />
          ))}
        </ul>
      </section>
    </div>
  )
}

/**
 * Story 1 件の表示（designs 2026-08-09 22:33 A-2）。
 *
 * **焼き込む側（app/s/[id]/page.tsx）とシェル側（app/s/page.tsx）で
 * 同じものを使う。**見た目が 2 通りに分かれると、焼かれた Story と
 * 焼かれていない Story で画面が違うことになる。
 *
 * 'use client' を付けない。Server Component からも Client Component からも
 * 呼べる形（状態も効果も持たない）にしておく。
 * 表示は React の既定エスケープに任せ、HTML を解釈しない。
 */
import { StoryTags } from './StoryTags'
import type { Story } from '../lib/write-api'

export function StoryView({ story }: { story: Story }) {
  return (
    <div className="hero">
      <p className="eyebrow">Story</p>
      <h1>{story.title}</h1>
      <p className="story-list__meta">
        <a href={`/w/${story.authorHandle}/`}>{story.authorHandle}</a> ・{' '}
        {new Date(story.createdAt).toLocaleDateString('ja-JP')}
        {story.hurdle && (
          <span className="story-list__hurdle">
            つまずき: {story.hurdle.status === 'resolved' ? '解決' : '未解決'} —{' '}
            {story.hurdle.text}
          </span>
        )}
      </p>
      <article className="story-body">{story.body}</article>
      {story.tools && story.tools.length > 0 && (
        <p className="story-list__tools">使ったツール: {story.tools.join(' / ')}</p>
      )}
      {story.gameyardUrl && (
        <p className="story-list__tools">
          作品: <a href={story.gameyardUrl}>{story.gameyardUrl}</a>
        </p>
      )}
      <StoryTags story={story} />
      <p className="plan__note">
        <a href="/stories/">新着一覧へ</a>
      </p>
    </div>
  )
}

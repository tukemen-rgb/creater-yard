/**
 * Story の一覧表示（designs 2026-08-10 00:34 A-3）。
 *
 * **焼き込む側（app/w/[handle]/・app/tags/[tag]/）とシェル側
 * （app/w/page.tsx・app/tags/page.tsx）で同じものを使う。**
 * 見た目が 2 通りに分かれると、焼かれた人と焼かれていない人で
 * 画面が違うことになる。
 *
 * `showAuthor` は個人ページで自分の名前を繰り返さないための切り替え。
 * **件数は出さない**（数字を競争にしない）。
 *
 * 'use client' を付けない。状態も効果も持たないので Server / Client の
 * どちらからも呼べる（StoryView と同じ作り）。
 */
import { StoryTags } from './StoryTags'
import type { Story } from '../lib/write-api'

const EXCERPT = 120

export function StoryList({
  stories,
  showAuthor = true,
}: {
  stories: Story[]
  showAuthor?: boolean
}) {
  return (
    <ul className="story-list">
      {stories.map((story) => (
        <li key={story.id} className="story-list__item">
          <h2>
            <a href={`/s/${story.id}/`}>{story.title}</a>
          </h2>
          <p className="story-list__meta">
            {showAuthor && (
              <>
                <a href={`/w/${story.authorHandle}/`}>{story.authorHandle}</a> ・{' '}
              </>
            )}
            {new Date(story.createdAt).toLocaleDateString('ja-JP')}
            {story.hurdle && (
              <span className="story-list__hurdle">
                つまずき: {story.hurdle.status === 'resolved' ? '解決' : '未解決'}
              </span>
            )}
          </p>
          <p className="story-list__excerpt">
            {story.body.length > EXCERPT ? `${story.body.slice(0, EXCERPT)}…` : story.body}
          </p>
          <StoryTags story={story} />
        </li>
      ))}
    </ul>
  )
}

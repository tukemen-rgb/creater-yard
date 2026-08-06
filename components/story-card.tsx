import Link from 'next/link'

import { formatDate, type Story } from '../lib/api'

/**
 * 一覧・個人ページで使う Story の 1 枚。本文は先頭だけ見せる。
 * 数字（閲覧数等）は出すものがそもそも無い（数字を競争にしない）。
 */
export function StoryCard({ story, showAuthor = true }: { story: Story; showAuthor?: boolean }) {
  const excerpt = story.body.length > 120 ? `${story.body.slice(0, 120)}…` : story.body
  return (
    <article className="story-card">
      <h2 className="story-card__title">
        <Link prefetch={false} href={`/story/?id=${story.id}`}>
          {story.title}
        </Link>
        {story.status === 'draft' && <span className="badge badge--draft">下書き</span>}
      </h2>
      <p className="story-card__meta">
        {showAuthor && (
          <>
            <Link prefetch={false} href={`/creators/?handle=${story.authorHandle}`}>
              {story.authorHandle}
            </Link>
            {' ・ '}
          </>
        )}
        {formatDate(story.publishedAt ?? story.updatedAt)}
      </p>
      {excerpt && <p className="story-card__excerpt">{excerpt}</p>}
      {(story.toolTags.length > 0 || story.topicTags.length > 0) && (
        <p className="story-card__tags">
          {story.toolTags.map((tag) => (
            <Link prefetch={false} key={`tool-${tag}`} className="tag" href={`/stories/?tool=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
          {story.topicTags.map((tag) => (
            <Link prefetch={false} key={`topic-${tag}`} className="tag tag--topic" href={`/stories/?topic=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
        </p>
      )}
    </article>
  )
}

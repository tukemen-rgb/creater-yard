import Link from 'next/link'

import { formatDate, imageUrl, type Story } from '../lib/api'
import { EditLink } from './edit-link'

/**
 * Story 本文の表示。server モードの実 URL ページと、下書きプレビュー
 * （クライアント側）の両方から使う。GAMEYARD の教訓 — テンプレートを
 * 2 つ作ると、片方だけ文言や構造が古くなる事故が起きる。
 */
export function StoryArticle({ story }: { story: Story }) {
  return (
    <article className="page story">
      <p className="story__back">
        <Link prefetch={false} href="/stories/">← Story 一覧</Link>
      </p>
      <h1 className="story__title">
        {story.title}
        {story.status === 'draft' && <span className="badge badge--draft">下書き</span>}
      </h1>
      <p className="story__meta">
        <Link prefetch={false} href={`/creators/${story.authorHandle}/`}>
          {story.authorHandle}
        </Link>
        {' ・ '}
        {formatDate(story.publishedAt ?? story.updatedAt)}
        <EditLink id={story.id} authorHandle={story.authorHandle} />
      </p>
      {story.image && (
        // Next の Image は最適化サーバー前提なので使わない（静的優先の構成。
        // next.config の images.unoptimized と同じ判断）
        <img
          className="story__image"
          src={imageUrl(story.image)}
          width={story.image.width}
          height={story.image.height}
          alt=""
        />
      )}
      <div className="story__body">{story.body}</div>
      {story.tools.length > 0 && (
        <p className="story__tools">使ったツール: {story.tools.join(' / ')}</p>
      )}
      {(story.toolTags.length > 0 || story.topicTags.length > 0) && (
        <p className="story-card__tags">
          {story.toolTags.map((tag) => (
            <Link
              prefetch={false}
              key={`tool-${tag}`}
              className="tag"
              href={`/stories/?tool=${encodeURIComponent(tag)}`}
            >
              {tag}
            </Link>
          ))}
          {story.topicTags.map((tag) => (
            <Link
              prefetch={false}
              key={`topic-${tag}`}
              className="tag tag--topic"
              href={`/stories/?topic=${encodeURIComponent(tag)}`}
            >
              {tag}
            </Link>
          ))}
        </p>
      )}
      {story.gameUrl && (
        <p className="story__game">
          この記録の作品: <a href={story.gameUrl}>{story.gameUrl}</a>（GAMEYARD）
        </p>
      )}
      <p className="story__report">
        <Link prefetch={false} href={`/report/?story=${story.id}`}>
          この Story の問題を通報する
        </Link>
      </p>
    </article>
  )
}

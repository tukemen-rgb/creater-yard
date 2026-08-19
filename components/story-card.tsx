import Link from 'next/link'

import { formatDate, imageUrl, type Story } from '../lib/api'
import { excerptSource } from '../lib/story-excerpt.ts'

/**
 * 一覧・個人ページで使う Story の 1 枚。本文は先頭だけ見せる。
 * 数字（閲覧数等）は出すものがそもそも無い（数字を競争にしない）。
 */
export function StoryCard({ story, showAuthor = true }: { story: Story; showAuthor?: boolean }) {
  const source = excerptSource(story.body)
  const excerpt = source.length > 120 ? `${source.slice(0, 120)}…` : source
  // 公開分は実 URL（server モードが返す）。下書きは本人トークンが要るので
  // プレビュー（/story/?id=）へ
  const href = story.status === 'draft' ? `/story/?id=${story.id}` : `/story/${story.id}/`
  return (
    <article className="story-card">
      <h2 className="story-card__title">
        <Link prefetch={false} href={href}>
          {story.title}
        </Link>
        {story.status === 'draft' && <span className="badge badge--draft">下書き</span>}
      </h2>
      <p className="story-card__meta">
        {showAuthor && (
          <>
            <Link prefetch={false} href={`/creators/${story.authorHandle}/`}>
              {story.authorHandle}
            </Link>
            {' ・ '}
          </>
        )}
        {formatDate(story.publishedAt ?? story.updatedAt)}
      </p>
      {story.hurdle && (
        <div className={`story-card__hurdle story-card__hurdle--${story.hurdle.status}`}>
          <span>{story.hurdle.status === 'resolved' ? '乗り越えた' : '悩み中'}</span>
          <strong>{story.hurdle.text}</strong>
        </div>
      )}
      {story.image && (
        // つまずき枠の**直後**に置く（設計 U-1）。この場所の主役はつまずき
        // なので、画像を最上部に出すと目が先に画像へ行き、つまずきが飾りに
        // 落ちる。つまずきの文を読んだ直後に、その現物が出る並びにする。
        //
        // Next の Image は使わない（story-article.tsx と同じ判断。最適化
        // サーバー前提で、静的優先の構成＝ next.config の images.unoptimized
        // と食い違う）。属性の並びも記事側に揃える —— テンプレートを 2 つ
        // 作ると片方だけ古くなる。
        //
        // ただし loading と decoding は**一覧にしかない要件**。1 ページ
        // 最大 20 枚（STORY_LIMITS.perPage）を即時に取りに行くと、画像を
        // 持たない書き手の記録まで表示が遅れる。
        <img
          className="story-card__image"
          src={imageUrl(story.image)}
          width={story.image.width}
          height={story.image.height}
          loading="lazy"
          decoding="async"
          // 記事側と同じ扱い。本人が書いた説明があれば読み上げへ、
          // 無ければ alt="" のまま＝装飾扱い（空も正しい答えとして許す）
          alt={story.imageAlt || ''}
        />
      )}
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

import Link from 'next/link'

import { formatDate, imageUrl, type Story } from '../lib/api'
import { CopyOwnStoryLink } from './copy-own-story-link'
import { EditLink } from './edit-link'
import { SaveStory } from './save-story'
import { StoryInvite } from './story-invite'
import { WriteNextLink } from './write-next-link'

/**
 * Story 本文の表示。server モードの実 URL ページと、下書きプレビュー
 * （クライアント側）の両方から使う。GAMEYARD の教訓 — テンプレートを
 * 2 つ作ると、片方だけ文言や構造が古くなる事故が起きる。
 */
export function StoryArticle({ story, nextStory }: { story: Story; nextStory?: Story | null }) {
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
          // 本人が書いた説明があればそれを読み上げへ。無ければ `alt=""` の
          // まま＝装飾扱い（事例 47 の判断木。説明を強制すると「画像1」の
          // ような無意味な alt が増えるので、空も正しい答えとして許す）
          alt={story.imageAlt || ''}
        />
      )}
      {story.hurdle && (
        <section
          className={`hurdle-card hurdle-card--${story.hurdle.status}`}
          aria-labelledby="hurdle-heading"
        >
          <p className="hurdle-card__eyebrow">
            {story.hurdle.status === 'resolved' ? '乗り越えた悩み' : 'いま向き合っている悩み'}
          </p>
          <h2 id="hurdle-heading" className="hurdle-card__text">{story.hurdle.text}</h2>
          <p className="hurdle-card__note">
            {story.hurdle.status === 'resolved'
              ? '本文で、作者がどう考えて解決したかを読めます。'
              : '同じことで悩んだ経験がある人は、作者の制作過程を見守れます。'}
          </p>
        </section>
      )}
      <div className="story__body">{story.body}</div>
      {story.status === 'public' && (
        <CopyOwnStoryLink id={story.id} authorHandle={story.authorHandle} />
      )}
      {story.status === 'public' && <SaveStory id={story.id} />}
      {/* 公開したあとの着地点から、次の 1 本へ（I-11）。本人にだけ出る。
          status === 'public' で囲むのは、StoryArticle が下書きプレビュー
          （app/story/page.common.tsx）からも使われるため —— 未公開のものを
          見ながら「その後を書く」は筋が通らない。すぐ上の SaveStory と
          同じ作法で、新しい形は持ち込んでいない。 */}
      {story.status === 'public' && <WriteNextLink authorHandle={story.authorHandle} />}
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
      {nextStory && (
        <section className="account-box" aria-labelledby="next-story-heading">
          <h2 id="next-story-heading">次に読む、別の作者の Story</h2>
          <p>
            <Link prefetch={false} href={`/story/${nextStory.id}/`}>
              {nextStory.title}
            </Link>
          </p>
          <p className="story-card__meta">書いた人: {nextStory.authorHandle}</p>
        </section>
      )}
      {story.sources && story.sources.length > 0 && (
        <section className="account-box" aria-labelledby="sources-heading">
          <h2 id="sources-heading">この記録のもとになった活動</h2>
          <ul className="story__sources">
            {story.sources.map((s) => (
              <li key={s.url}>
                {/* 評価を渡さない(nofollow)・元の窓を触らせない(noopener)・
                    **参照元を送らない(noreferrer)**。noopener だけでは Referer は出る */}
                <a href={s.url} rel="nofollow noopener noreferrer" target="_blank">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* 読む道（次の Story）→ **書く道** → 通報 の順（設計 U-14）。
          通報は最後に残す —— 困っている人が最後に迷わないため。 */}
      {story.status === 'public' && <StoryInvite authorHandle={story.authorHandle} />}
      <p className="story__report">
        <Link prefetch={false} href={`/report/?story=${story.id}`}>
          この Story の問題を通報する
        </Link>
      </p>
    </article>
  )
}

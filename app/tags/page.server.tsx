import type { Metadata } from 'next'
import Link from 'next/link'

import { tagIndex } from '../../lib/stories-read'

/**
 * タグ索引（server モード）。リクエスト時に store を読んで組み立てる。
 * static モード用は page.static.tsx（ブラウザから API を読む版）。
 * 見出しや文言を変えるときは両方を直すこと。
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'タグから探す',
  description: 'ツール名と「どこでつまずいたか」で制作記録を探す。',
}

export default function TagsPage() {
  const index = tagIndex()
  return (
    <div className="page">
      <h1>タグから探す</h1>
      <p className="page__lede">
        あなたの遠回りが、誰かの近道になる。ツール名と「どこでつまずいたか」で記録を引けます。
      </p>
      <section className="tag-section">
        <h2>ツール</h2>
        {index.tools.length === 0 && <p className="notice">まだタグがありません。</p>}
        <p className="story-card__tags">
          {index.tools.map(({ tag, count }) => (
            <Link
              prefetch={false}
              key={tag}
              className="tag"
              href={`/stories/?tool=${encodeURIComponent(tag)}`}
            >
              {tag}（{count}）
            </Link>
          ))}
        </p>
      </section>
      <section className="tag-section">
        <h2>つまずき・トピック</h2>
        {index.topics.length === 0 && <p className="notice">まだタグがありません。</p>}
        <p className="story-card__tags">
          {index.topics.map(({ tag, count }) => (
            <Link
              prefetch={false}
              key={tag}
              className="tag tag--topic"
              href={`/stories/?topic=${encodeURIComponent(tag)}`}
            >
              {tag}（{count}）
            </Link>
          ))}
        </p>
      </section>
    </div>
  )
}

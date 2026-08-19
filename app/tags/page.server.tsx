
import Link from 'next/link'

import { tagIndex } from '../../lib/stories-read'

/**
 * タグ索引（server モード）。リクエスト時に store を読んで組み立てる。
 * static モード用は page.static.tsx（ブラウザから API を読む版）。
 * 見出しや文言を変えるときは両方を直すこと。
 */
export const dynamic = 'force-dynamic'

// カード（canonical と OGP）は layout.common.tsx が持つ。**層に置くのは
// 2 つのモードで同じものを配るため**（page.static.tsx は client なので持てない）。

export default function TagsPage() {
  const index = tagIndex()
  // 両軸とも空のときだけ、節の外に出口を 1 つ置く（設計 U-5）。
  // 片側だけ空なら出さない —— もう片方に押せるものが並んでいるのに
  // 「まだ何も無い」と誘うのは、画面と食い違う。
  // 数はここで分けるためだけに使い、画面には出さない
  // （標準制約「公開カウンタを作らない」）。
  const nothingYet = index.tools.length === 0 && index.topics.length === 0
  return (
    <div className="page">
      <h1>タグから探す</h1>
      <p className="page__lede">
        あなたの遠回りが、誰かの近道になる。ツール名と「どこでつまずいたか」で記録を引けます。
      </p>
      {nothingYet && (
        <p className="notice">
          タグは Story に付けると増えます —{' '}
          <Link prefetch={false} href="/write/">
            最初の 1 本を書きませんか。
          </Link>
        </p>
      )}
      <section className="tag-section">
        <h2>ツール</h2>
        {index.tools.length === 0 && <p className="notice">まだありません。</p>}
        <p className="story-card__tags">
          {index.tools.map((tag) => (
            // 出すのは書き手が打った書き方、押した先の鍵は小文字のまま。
            // 混ぜると、既に配った絞り込みの URL が壊れる（設計 U-6）
            <Link
              prefetch={false}
              key={tag}
              className="tag"
              href={`/stories/?tool=${encodeURIComponent(tag)}`}
            >
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
            <Link
              prefetch={false}
              key={tag}
              className="tag tag--topic"
              href={`/stories/?topic=${encodeURIComponent(tag)}`}
            >
              {tag}
            </Link>
          ))}
        </p>
      </section>
    </div>
  )
}

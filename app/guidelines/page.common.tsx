import type { Metadata } from 'next'

import { absoluteUrl, alternatesFor, ogWithUrl } from '../../lib/og'
import Link from 'next/link'

/**
 * この場所の決まり。SPEC §2 の文化 5 箇条を、利用者に向けた言葉で書く。
 * 実装がまだのものをあるように書かない。決まりを増やすときは SPEC と
 * 一緒に直す（片方だけ直すとずれる）。
 */
/**
 * 貼られたときのカード（設計 A-2）。**この面は公開されていて貼られうる。**
 *
 * `og:url` を出すのは、`?utm_source=…` の付いたリンクが別の対象として
 * 扱われないようにするため（OGP の必須 4 項目の 1 つ・事例 36）。
 *
 * `openGraph` に題名と説明を明示するのは、layout の `title.template`
 * （`%s | CreatorYard`）が `og:title` にも当たり、**`og:site_name` と
 * ブランドが二重になる**ため。ブランドは `og:site_name` が運ぶ。
 */
const canonical = absoluteUrl('/guidelines/')
const title = 'この場所の決まり'
const description = 'CreatorYard の文化と、書いてよいもの・受け付けないもの。'

export const metadata: Metadata = {
  title,
  description,
  alternates: alternatesFor(canonical),
  openGraph: { ...ogWithUrl(canonical, 'website'), title, description },
}

export default function GuidelinesPage() {
  return (
    <div className="page page--narrow">
      <h1>この場所の決まり</h1>
      <p className="page__lede">
        CreatorYard は、ゲームを作る過程の記録（Creator Story）が集まる場所です。
        姉妹サービス <a href="https://play-game-yard.com/">GAMEYARD</a> と同じ文化で運営します。
      </p>

      <section className="tag-section">
        <h2>この場所が守ること</h2>
        <ul>
          <li>
            <strong>完成度で人を落とさない。</strong>
            未完成・作りかけ・頓挫した記録が主役です。
          </li>
          <li>
            <strong>数字を競争にしない。</strong>
            順位表・称号・公開の閲覧カウンタは作りません。
          </li>
          <li>
            <strong>記録はあなたのもの。</strong>
            {/* 「あなたの記録」と書かない（U-18）。書きかけも「記録」に読める
                のに、退会で消えるのはサーバー側の Story と画像である。 */}
            Story はいつでも消せます。退会すれば、あなたの Story も画像もすべて消えます。
            引き止めの手続きは置きません。
          </li>
          <li>
            <strong>使ったツールを隠させない。</strong>
            AI を含め、何で作ったかを普通に書ける場所です。書いたことで不利に
            扱われることはありません。
          </li>
          <li>
            <strong>個人の行動を計測しない。</strong>
            誰が何を読んだかは記録しません。持つのはサイト全体の合計値だけです。
            詳しくは<Link prefetch={false} href="/data-policy/">データの扱い</Link>へ。
          </li>
        </ul>
      </section>

      <section className="tag-section">
        <h2>書き手にお願いすること</h2>
        <ul>
          <li>自分の制作の記録を書いてください（他人の文章・画像の転載はしない）</li>
          <li>実在の人物への攻撃・晒し・個人情報の掲載はしない</li>
          <li>宣伝だけの投稿はしない（制作の記録に作品リンクを添えるのは歓迎です）</li>
        </ul>
      </section>

      <section className="tag-section">
        <h2>問題を見つけたら</h2>
        <p>
          権利侵害・不適切な内容は<Link prefetch={false} href="/report/">通報フォーム</Link>から
          知らせてください。アカウントは要りません。通報で自動的に公開が止まることは
          なく、運営が内容を確認して判断します。
        </p>
      </section>
    </div>
  )
}

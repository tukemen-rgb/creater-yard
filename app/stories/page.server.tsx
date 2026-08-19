import type { Metadata } from 'next'
import { alternatesFor, SITE_FEED, SITE_OG, storiesFilterUrl, storiesListPath } from '../../lib/og'
import Link from 'next/link'

import { StoryCard } from '../../components/story-card'
import { Pager } from '../../components/pager'
import { publishedStories } from '../../lib/stories-read'

/**
 * 公開 Story の一覧（server モード）。リクエスト時に store を読んで
 * HTML を組み立てる。タグ絞り込み（?tool= / ?topic=）の結果ページが
 * そのまま検索の着地点になる（タグ SEO — ACQUISITION A1）。
 *
 * static モード用は page.static.tsx（ブラウザから API を読む版）。
 * 見出しや文言を変えるときは両方を直すこと。
 */
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ tool?: string; topic?: string; page?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tool, topic, page } = await searchParams
  const filter = tool || topic
  const title = filter ? `「${filter}」の Story` : 'Creator Story'
  const description = filter
    ? `「${filter}」に関する制作記録（Creator Story）の一覧。`
    : 'つくる過程の記録。作りかけ・つまずき・工夫、ぜんぶ主役。'
  // 本文と同じ一覧結果を使い、範囲外の page を実在する最終ページへ丸める。
  // 生の page を使うと、空一覧の ?page=2 などが 1 ページ目と同じ本文なのに
  // 別 canonical を名乗ってしまう。
  const listing = publishedStories({ page: Number(page) || 1, tool: tool ?? '', topic: topic ?? '' })
  const canonical = storiesFilterUrl(tool, topic, String(listing.page))
  return {
    title,
    description,
    alternates: alternatesFor(canonical),
    openGraph: {
      // **展開を忘れると親の og:site_name・og:locale が丸ごと消える。**
      // Next の metadata は shallow merge で、子が openGraph を書くと
      // 親の入れ子はまとめて置き換わる（この罠はこの repo で 2 回踏んでいる）。
      ...SITE_OG,
      title,
      description,
      type: 'website',
      ...(canonical ? { url: canonical } : {}),
    },
  }
}

export default async function StoriesPage({ searchParams }: Props) {
  const { tool = '', topic = '', page } = await searchParams
  const listing = publishedStories({ page: Number(page) || 1, tool, topic })
  // I-9: 表示中のページに何人の書き手が並んでいるか。**分岐にだけ使い、
  // 画面には出さない**（出せば公開カウンタになる）。StoryListing に項目を
  // 足さないのは、static モードが API から stories 配列を受け取るからで、
  // この 1 行なら両モードで同じように効く。
  const authorsOnPage = new Set(listing.stories.map((s) => s.authorHandle)).size

  // I-8: 効いている条件を**全部**集める。以前は `tool || topic` で、
  // ?tool=godot&topic=影 のとき「godot」だけを名乗っていた。結果は
  // 2 条件の AND なのに、画面は 1 条件しか言わない小さな嘘だった
  // （ページ送りで同じ穴を #8 が塞いだのと同じ族）。
  // 空白だけの値は数えない —— 効いていない条件が効いて見えるため。
  // static 版（page.static.tsx）も同じ形にすること。
  const filterLabels = [tool, topic].filter((v) => v?.trim())
  // ページ送りは絞り込み条件を落とさない（tool と topic の両方を保持。
  // 以前は片方を捨てていて、AND 絞り込みの 2 条件目が「次へ」で消えていた）
  const pageHref = (n: number) => storiesListPath(tool, topic, n)

  return (
    <div className="page">
      <h1>Creator Story</h1>
      <p className="page__lede">
        つくる過程の記録。作りかけ・つまずき・工夫、ぜんぶ主役。{' '}
        <Link prefetch={false} href="/tags/">タグから探す</Link>
      </p>
      {filterLabels.length > 0 && (
        <p className="notice">
          {filterLabels.map((v) => `「${v}」`).join('')}で絞り込み中 —{' '}
          <Link prefetch={false} href="/stories/">解除する</Link>
        </p>
      )}
      {listing.stories.length === 0 && (
        <p className="notice">
          まだ Story がありません。
          <Link prefetch={false} href="/write/">最初の 1 本を書きませんか。</Link>
        </p>
      )}
      {listing.stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
      {/* 並びの説明は最初の Story カードより後ろに置く（経営判断 2026-08-10 22:00）。
          説明は消さない — 「閲覧数ランキングではありません」は文化の説明として要る。
          Story が 0 件のときは説明する対象が無いので出さない。

          I-9: 前半（並べ方の説明）は、書き手が 2 人以上のページでだけ出す。
          1 人しか並んでいないページで「同じ作者が続かないように」と言われても、
          説明する対象が無い。**後半は条件に入れない** — 上の経営判断のとおり
          文化の説明は常に出す。
          <p> は 1 つのままにする（2 つに割ると .notice が連続して余白が変わる）。
          static 版（page.static.tsx）も同じ形にすること。server/sort-notice.test.mjs
          が 2 ファイルを回して確かめている。 */}
      {listing.stories.length > 0 && (
        <p className="notice">
          {authorsOnPage > 1 && '新しい記録を基準に、同じ作者が続かないように並べています。'}
          閲覧数ランキングではありません。
        </p>
      )}
      {/* 全体 RSS への**見えるリンク**。head の autodiscovery だけで
          終わらせない（受入条件 2026-08-08 15:02）。購読に登録は要らない。
          URL は API の実体と同じにする — 広告した URL が 200 を返さないと、
          購読者の手元に死んだ URL が永久に残る。 */}
      <p className="notice">
        新着を追うなら{' '}
        <a href={SITE_FEED}>RSS で受け取れます</a>
        （登録は要りません）。
      </p>
      <Pager
        page={listing.page}
        totalPages={listing.totalPages}
        prevHref={pageHref(listing.page - 1)}
        nextHref={pageHref(listing.page + 1)}
      />
    </div>
  )
}

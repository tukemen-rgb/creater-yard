/**
 * 書き手の個人ページを焼き込む（designs 2026-08-10 00:34 A-3）。
 *
 * **Server Component。**'use client' を付けたら generateMetadata が
 * 動かなくなる（事例 35）。
 *
 * 焼かれるのは**公開 Story を 1 本でも持っている人だけ**。
 * 下書きしか書いていない人のハンドルは URL にも出ない
 * （publicHandles が公開分から作られるため）。
 *
 * シェル（app/w/page.tsx）は消さない。焼き込みの後に増えた人は
 * まだ静的ファイルが無く、nginx の try_files がシェルへ落とす。
 */
import type { Metadata } from 'next'

import { StoryList } from '../../../components/StoryList'
import { absoluteUrl, alternatesFor, handleFeedPath, SITE_OG } from '../../../lib/og'
import { publicHandles, readPublicStories } from '../../../lib/stories-static'

/**
 * 公開 Story が 0 件のときの受け皿。空の配列を返すと
 * `output: 'export'` がビルドごと落ちる（A-2 で踏んだ・361d6ea）。
 * 先頭の `_` は登録できるハンドルの形（`/^[a-z0-9][a-z0-9_-]{2,31}$/`）に
 * 通らないので、実在の人とぶつからない。
 */
const PLACEHOLDER = '_none'

export function generateStaticParams() {
  const handles = publicHandles().map((handle) => ({ handle }))
  return handles.length > 0 ? handles : [{ handle: PLACEHOLDER }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  if (publicHandles().indexOf(handle) === -1) return {}

  const title = `${handle} の制作記録`
  const description = `${handle} さんが CreatorYard に書いた制作記録。`
  const url = absoluteUrl(`/w/${handle}/`)

  return {
    title,
    description,
    // canonical は og:url と同じ値。ずれると「og が指す URL と canonical が
    // 違う」という一番よくない状態になるので、両方 absoluteUrl から取る。
    // **個人ページの RSS 発見は本人のフィード**を指す（A-6）。
    // 下書きしか無い人・居ない人も 200・0 件で揃うことを確認済みなので、
    // ここから他人の存在は分からない
    alternates: alternatesFor(url, handleFeedPath(handle)),
    openGraph: {
      ...SITE_OG,
      title,
      description,
      type: 'website',
      ...(url ? { url } : {}),
    },
  }
}

export default async function BakedWriterPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const stories = readPublicStories({ author: handle })
  // 取れないのは受け皿（公開 0 件）のときだけ。シェルと同じ文言を出す
  if (stories.length === 0) {
    return (
      <div className="hero">
        <p className="eyebrow">書き手</p>
        <h1>見つかりません</h1>
        <p className="hero__lede">
          このページは存在しません。<a href="/stories/">新着一覧へ戻る</a>
        </p>
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">書き手</p>
      <h1>{handle} の制作記録</h1>
      <p className="hero__lede">新しい順に並びます。</p>
      <StoryList stories={stories} showAuthor={false} />
    </div>
  )
}

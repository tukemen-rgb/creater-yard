/**
 * タグページを焼き込む（designs 2026-08-10 00:34 A-3）。
 *
 * **Server Component。**URL は軸で分けない `/tags/<tag>/`
 * （1 つの語でツール軸・トピック軸を横断。designs 00:22）。
 *
 * 焼かれるのは**公開 Story に付いたタグだけ**。下書きだけに在るタグは
 * publicTagVocabulary が公開分しか見ないので URL にも出ない。
 *
 * シェル（app/tags/page.tsx）は消さない。
 */
import type { Metadata } from 'next'

import { StoryList } from '../../../components/StoryList'
import { tagUrl } from '../../../lib/og'
import { publicTags, readPublicStories } from '../../../lib/stories-static'

/** 公開タグが 0 件のときの受け皿（app/w/[handle]/ と同じ理由）。 */
const PLACEHOLDER = '_none'

/**
 * Next が渡す経路の一片は **URL エンコード済み**。
 * `publicTags()` が返すのは生のタグなので、突き合わせる前に戻す。
 *
 * これを忘れると、日本語のタグページが**まるごと「見つかりません」で
 * 焼かれる**（2026-08-09 に実際に焼いて発見した。ASCII のタグは
 * エンコードされないので通ってしまい、日本語だけが壊れる）。
 *
 * 壊れた `%` が来ても落とさない（焼くのは自分のタグだけだが、
 * 開発時に手で URL を打つことがある）。
 */
function decodeTag(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function generateStaticParams() {
  // 生のタグを渡す。ファイル名の encode は Next がやる。
  // URL を作るときだけ encode する（tagUrl）。ここを混同すると、
  // 焼かれる場所と canonical が食い違う
  const tags = publicTags().map((tag) => ({ tag }))
  return tags.length > 0 ? tags : [{ tag: PLACEHOLDER }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>
}): Promise<Metadata> {
  const tag = decodeTag((await params).tag)
  if (publicTags().indexOf(tag) === -1) return {}

  const title = `#${tag} の制作記録`
  const description = `${tag} のタグが付いた制作記録。新しい順に並びます。`
  const url = tagUrl(tag)

  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title,
      description,
      siteName: 'CreatorYard',
      type: 'website',
      ...(url ? { url } : {}),
    },
  }
}

export default async function BakedTagPage({ params }: { params: Promise<{ tag: string }> }) {
  const tag = decodeTag((await params).tag)
  const stories = readPublicStories({ tag })
  if (stories.length === 0) {
    return (
      <div className="hero">
        <p className="eyebrow">タグ</p>
        <h1>見つかりません</h1>
        <p className="hero__lede">
          このタグページは開けませんでした。<a href="/stories/">新着一覧へ戻る</a>
        </p>
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">タグ</p>
      <h1>#{tag}</h1>
      <p className="hero__lede">このタグが付いた制作記録。新しい順に並びます。</p>
      <StoryList stories={stories} />
    </div>
  )
}

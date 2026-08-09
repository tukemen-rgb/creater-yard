/**
 * 公開 Story を 1 件ずつ焼き込む（designs 2026-08-09 22:33 A-2）。
 *
 * **Server Component。**`generateMetadata` は Server Component でしか
 * 動かない（事例 35・Next.js 公式）ので、Story 固有の OGP を出すには
 * ここが Server である必要がある。'use client' を付けたら壊れる。
 *
 * 焼かれるのは**公開分だけ**。id を知っていても下書きは焼かれない
 * （A-1 の readPublicStory が viewerId 無しで getVisible を呼ぶため）。
 *
 * シェル（app/s/page.tsx）は消さない。焼き込みの後に増えた Story は
 * まだ静的ファイルが無く、nginx の try_files がシェルへ落とす。
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { StoryView } from '../../../components/StoryView'
import { absoluteUrl, ogDescription } from '../../../lib/og'
import { readPublicStories, readPublicStory } from '../../../lib/stories-static'

export function generateStaticParams() {
  return readPublicStories().map(({ id }) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const story = readPublicStory(id)
  if (!story) return {}

  const description = ogDescription(story.body)
  const url = absoluteUrl(`/s/${story.id}/`)

  return {
    title: story.title,
    description,
    openGraph: {
      // 題名にサイト名を混ぜない（Meta の推奨）。ブランドは siteName が運ぶ
      title: story.title,
      description,
      siteName: 'CreatorYard',
      type: 'article',
      // SITE_ORIGIN が無いときは url を出さない（嘘の URL を焼かない）
      ...(url ? { url } : {}),
      // og:image は出さない。画像は未定（提案 25 は要判断）で、
      // 空文字や存在しない URL を焼くほうが悪い
    },
  }
}

export default async function BakedStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = readPublicStory(id)
  // generateStaticParams が返した id は必ず取れるはず。取れないなら
  // 設計の誤りなので握り潰さない
  if (!story) notFound()
  return <StoryView story={story} />
}

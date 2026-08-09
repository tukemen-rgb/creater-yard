import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StoryArticle } from '../../../components/story-article'
import { nextStoryFromAnotherAuthor, publishedStory } from '../../../lib/stories-read'

/**
 * Story の実 URL（/story/<id>/）。server モードがリクエスト時に組み立てる。
 * 本文が HTML に入ることが検索流入（タグ SEO）の前提。
 * 下書きはここでは出さない — 下書きの閲覧は本人トークン付きの
 * プレビュー（/story/?id=）の仕事で、存在も明かさない（404 に揃える）。
 */
type Props = { params: Promise<{ id: string }> }

/** 本文の先頭を説明文にする。改行は 1 行に潰す（メタタグに改行は入れない）。 */
function excerpt(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const story = publishedStory(id)
  if (!story) return {}
  // OGP の画像は絶対 URL でなければ拾われない。公開オリジンは
  // ドメイン決定後に CY_SITE_ORIGIN で入る（未設定なら画像なしで出す）
  const origin = process.env.CY_SITE_ORIGIN
  const ogImage =
    story.image && origin
      ? [{ url: `${origin}/api/images/${story.image.id}.${story.image.ext}` }]
      : undefined
  return {
    title: story.title,
    description: excerpt(story.body),
    openGraph: {
      title: story.title,
      description: excerpt(story.body),
      type: 'article',
      images: ogImage,
    },
  }
}

export default async function StoryPage({ params }: Props) {
  const { id } = await params
  const story = publishedStory(id)
  if (!story) notFound()
  const nextStory = nextStoryFromAnotherAuthor(story)
  return <StoryArticle story={story} nextStory={nextStory} />
}

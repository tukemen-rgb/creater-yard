/**
 * Story のタグ表示（designs.md 2026-08-09 00:22 段階 B）。
 * 2 軸をまとめて 1 列に出す。リンク先はタグページ（軸で分けない決め）。
 * 件数は出さない。
 */
import type { Story } from '../lib/write-api'

export function StoryTags({ story }: { story: Pick<Story, 'tags'> }) {
  const tags = [...(story.tags?.tool ?? []), ...(story.tags?.topic ?? [])]
  if (tags.length === 0) return null
  return (
    <p className="story-tags">
      {tags.map((tag) => (
        <a key={tag} href={`/tags/${encodeURIComponent(tag)}/`} className="story-tags__tag">
          #{tag}
        </a>
      ))}
    </p>
  )
}

/**
 * sitemap.xml（designs 2026-08-10 02:33 A-4）。
 *
 * **載せないものを先に決めてある**（同設計の表）。ここで守るのは 5 つ:
 *
 *   1. 受け皿（`/w/_none/`・`/tags/_none/`）を載せない
 *   2. 引数なしのシェル（`/s/`・`/w/`・`/tags/`）を載せない
 *      — 引数なしで開くと「見つかりません」を出すページなので
 *   3. ログインの道具（`/mine/`・`/login/`・`/register/`）を載せない
 *   4. `priority` と `changefreq` を出さない
 *      — **Google が「無視する」と明言している**（事例 39）。
 *        読まれないものを埋めると手入れしたように見えて実態が無いし、
 *        `0.8` のような数字には根拠が無い
 *   5. 固定ページに `lastModified` を持たせない（09:20・10:20 補記）
 *
 * `SITE_ORIGIN` が無ければ**空を返す**。Google は
 * 「fully-qualified, absolute URLs」を求め「exactly as listed」
 * （書いたとおりに辿る）と書いているので、相対 URL で埋めると
 * **辿れない URL の一覧を配る**ことになる。空のほうが正直で害が無い。
 */
import type { MetadataRoute } from 'next'

import { absoluteUrl, handleUrl, storyUrl, tagUrl } from '../lib/og'
import { publicHandles, publicTags, readPublicStories } from '../lib/stories-static'

export const dynamic = 'force-static'

/** 載せる固定ページ。**列挙で持つ**（除外条件を書かない）。増えたら足す。 */
const FIXED = ['/', '/stories/', '/write/']

/** そこに載る公開 Story の updatedAt の最大値。ビルド時刻は使わない。 */
function latestUpdate(stories: { updatedAt: string }[]): string | undefined {
  let max: string | undefined
  for (const { updatedAt } of stories) {
    if (!max || updatedAt > max) max = updatedAt
  }
  return max
}

export default function sitemap(): MetadataRoute.Sitemap {
  // SITE_ORIGIN が無ければ空。辿れない URL の一覧を配らない
  if (!absoluteUrl('/')) return []
  const all = readPublicStories()

  const entries: MetadataRoute.Sitemap = []
  const push = (url: string | null, lastModified?: string) => {
    if (!url) return
    entries.push(lastModified ? { url, lastModified } : { url })
  }

  for (const path of FIXED) push(absoluteUrl(path))
  for (const story of all) push(storyUrl(story.id), story.updatedAt)
  for (const handle of publicHandles()) {
    push(handleUrl(handle), latestUpdate(readPublicStories({ author: handle })))
  }
  for (const tag of publicTags()) {
    push(tagUrl(tag), latestUpdate(readPublicStories({ tag })))
  }
  return entries
}

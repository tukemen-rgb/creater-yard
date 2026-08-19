import { MAX_SAVED_STORIES, readValue, writeValue } from './device-storage.ts'

export { MAX_SAVED_STORIES }

const SAVED_STORIES_KEY = 'cy-saved-story-ids'
const STORY_ID_RE = /^[A-Za-z0-9_-]{8}$/


/**
 * 保存情報はこのブラウザだけに置き、APIへ送らない。
 * Story ID以外を持たないため、本文・作者・閲覧履歴の複製にもならない。
 */
export function savedStoryIds(): string[] {
  try {
    const value: unknown = JSON.parse(readValue(SAVED_STORIES_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && STORY_ID_RE.test(id)))]
      .slice(0, MAX_SAVED_STORIES)
  } catch {
    // ここの try は **JSON.parse 用**。端末の保存領域そのものは
    // readValue が囲っている（lib/device-storage.ts）
    return []
  }
}

/** 保存できたら true（端末が保存を拒否していれば偽）。 */
export function saveStoryIds(ids: string[]): boolean {
  const clean = [...new Set(ids.filter((id) => STORY_ID_RE.test(id)))].slice(0, MAX_SAVED_STORIES)
  return writeValue(SAVED_STORIES_KEY, JSON.stringify(clean))
}

/**
 * いっぱいのときに、押す前に出す一言（設計 U-8 の (a)）。
 *
 * **上限そのものは動かさない。**`toggleSavedStory` は前から
 * `slice(0, MAX_SAVED_STORIES)` で切っており、**51 本目を押すと
 * いちばん古い 1 本が黙って落ちていた**（2026-08-19 に①がブラウザで
 * 確かめた。ボタンは「保存を解除する」に変わり、画面は何も言わなかった）。
 *
 * 落ちること自体は決まりどおりで、直すのは**黙っていること**のほう。
 * NN/g のヒューリスティクス #5 が言う `warning your users` にあたる
 * （事例 76）。
 *
 * すでに保存してある Story では出さない —— そこで押すのは**解除**であり、
 * 何も落ちないため。
 */
export function savedLimitNotice(savedCount: number, alreadySaved: boolean): string | null {
  if (alreadySaved || savedCount < MAX_SAVED_STORIES) return null
  return `保存できるのは ${MAX_SAVED_STORIES} 本までです。押すと、いちばん古い 1 本が外れます。`
}

export function toggleSavedStory(id: string): boolean {
  const current = savedStoryIds()
  const saved = !current.includes(id)
  saveStoryIds(saved ? [id, ...current] : current.filter((item) => item !== id))
  return saved
}

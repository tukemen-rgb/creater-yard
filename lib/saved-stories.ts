const SAVED_STORIES_KEY = 'cy-saved-story-ids'
const STORY_ID_RE = /^[A-Za-z0-9_-]{8}$/

/**
 * 端末に持つ上限。**緩めるのは人の判断**（CLAUDE.md の「人が決めるまで
 * 変えない一覧」）。ここを **export しているのは、画面に出す文言と
 * 試験がこの値を写さずに済ませるため**（PR #50・#51 と同じ形）。
 */
export const MAX_SAVED_STORIES = 50

/**
 * 保存情報はこのブラウザだけに置き、APIへ送らない。
 * Story ID以外を持たないため、本文・作者・閲覧履歴の複製にもならない。
 */
export function savedStoryIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SAVED_STORIES_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && STORY_ID_RE.test(id)))]
      .slice(0, MAX_SAVED_STORIES)
  } catch {
    return []
  }
}

export function saveStoryIds(ids: string[]) {
  if (typeof window === 'undefined') return
  const clean = [...new Set(ids.filter((id) => STORY_ID_RE.test(id)))].slice(0, MAX_SAVED_STORIES)
  window.localStorage.setItem(SAVED_STORIES_KEY, JSON.stringify(clean))
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

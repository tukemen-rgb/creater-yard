const SAVED_STORIES_KEY = 'cy-saved-story-ids'
const STORY_ID_RE = /^[A-Za-z0-9_-]{8}$/
const MAX_SAVED_STORIES = 50

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

export function toggleSavedStory(id: string): boolean {
  const current = savedStoryIds()
  const saved = !current.includes(id)
  saveStoryIds(saved ? [id, ...current] : current.filter((item) => item !== id))
  return saved
}

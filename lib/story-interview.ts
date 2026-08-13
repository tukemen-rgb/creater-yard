export const INTERVIEW_DRAFT_KEY = 'creatoryard:story-interview-draft'

export type InterviewDraft = {
  title: string
  body: string
  hurdleText: string
}

export const INTERVIEW_QUESTIONS = [
  {
    label: 'いま、何をつくっていますか？',
    hint: '作品名が決まっていなくても、ゲーム・イラスト・音楽などで大丈夫です。',
    placeholder: '例：古い動物園を探索するホラーゲーム',
  },
  {
    label: '今日は何を試しましたか？',
    hint: 'うまくいったことも、途中のことも、そのまま話してください。',
    placeholder: '例：追いかけてくる敵の動きを調整した',
  },
  {
    label: 'いま悩んでいること、または乗り越えたことは？',
    hint: '同じ悩みを持つ人が見つけやすくなる部分です。なければ「なし」でも進めます。',
    placeholder: '例：敵が角で引っかかる原因が分からない',
  },
  {
    label: '次に何を試しますか？',
    hint: '小さな一歩で大丈夫です。あとで続きを書くときの目印になります。',
    placeholder: '例：当たり判定を見直して、もう一度テストする',
  },
] as const

export function buildInterviewDraft(answers: string[]): InterviewDraft {
  const [making = '', tried = '', hurdle = '', next = ''] = answers.map((answer) => answer.trim())
  const body = [
    `【つくっているもの】\n${making}`,
    `【今日試したこと】\n${tried}`,
    `【次に試すこと】\n${next}`,
  ].join('\n\n')

  return {
    title: making.slice(0, 80),
    body: body.slice(0, 8000),
    hurdleText: hurdle === 'なし' ? '' : hurdle.slice(0, 200),
  }
}

export function saveInterviewDraft(draft: InterviewDraft) {
  window.localStorage.setItem(INTERVIEW_DRAFT_KEY, JSON.stringify(draft))
}

function readInterviewDraft(removeAfterRead: boolean): InterviewDraft | null {
  try {
    const raw = window.localStorage.getItem(INTERVIEW_DRAFT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<InterviewDraft>
    if (typeof value.title !== 'string' || typeof value.body !== 'string' || typeof value.hurdleText !== 'string') {
      window.localStorage.removeItem(INTERVIEW_DRAFT_KEY)
      return null
    }
    if (removeAfterRead) window.localStorage.removeItem(INTERVIEW_DRAFT_KEY)
    return {
      title: value.title.slice(0, 80),
      body: value.body.slice(0, 8000),
      hurdleText: value.hurdleText.slice(0, 200),
    }
  } catch {
    try {
      window.localStorage.removeItem(INTERVIEW_DRAFT_KEY)
    } catch {
      // Storage may be entirely unavailable (for example, in a restricted browser mode).
    }
    return null
  }
}

export function hasInterviewDraft() {
  return Boolean(readInterviewDraft(false))
}

export function takeInterviewDraft(): InterviewDraft | null {
  return readInterviewDraft(true)
}

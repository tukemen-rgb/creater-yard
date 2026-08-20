import { readValue, removeValue, writeValue, type Kept } from './device-storage.ts'

export const INTERVIEW_DRAFT_KEY = 'creatoryard:story-interview-draft'
export const INTERVIEW_PROGRESS_KEY = 'creatoryard:story-interview-progress'

export type InterviewDraft = {
  title: string
  body: string
  hurdleText: string
}

export type InterviewProgress = {
  answers: string[]
  step: number
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

export function appendInterviewTranscript(current: string, transcript: string) {
  const before = current.trimEnd()
  const spoken = transcript.trim()
  return `${before}${before && spoken ? ' ' : ''}${spoken}`.slice(0, 1200)
}

/** 保存できたら true（端末が保存を拒否していれば偽）。 */
export function saveInterviewDraft(draft: InterviewDraft): Kept {
  return writeValue(INTERVIEW_DRAFT_KEY, JSON.stringify(draft))
}

export function saveInterviewProgress(progress: InterviewProgress) {
  // 受け取らない理由: 端末が保存を拒否していても、ヒアリングそのものは進む
  // （続きから再開できないだけで、書いている手は止めない）。U-13 の設計どおり。
  writeValue(INTERVIEW_PROGRESS_KEY, JSON.stringify({
    answers: progress.answers.map((answer) => answer.slice(0, 1200)),
    step: Math.min(Math.max(progress.step, 0), INTERVIEW_QUESTIONS.length - 1),
  }))
}

export function loadInterviewProgress(): InterviewProgress | null {
  try {
    const raw = readValue(INTERVIEW_PROGRESS_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<InterviewProgress>
    if (!Array.isArray(value.answers)
      || value.answers.length !== INTERVIEW_QUESTIONS.length
      || value.answers.some((answer) => typeof answer !== 'string')
      || !Number.isInteger(value.step)) {
      removeValue(INTERVIEW_PROGRESS_KEY)
      return null
    }
    return {
      answers: value.answers.map((answer) => answer.slice(0, 1200)),
      step: Math.min(Math.max(value.step as number, 0), INTERVIEW_QUESTIONS.length - 1),
    }
  } catch {
    try {
      removeValue(INTERVIEW_PROGRESS_KEY)
    } catch {
      // Storage may be entirely unavailable.
    }
    return null
  }
}

export function clearInterviewProgress() {
  try {
    removeValue(INTERVIEW_PROGRESS_KEY)
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

/**
 * **退会したときに、この端末から書いたものを消す**（U-18）。
 *
 * **`clearSession()`（`lib/api.ts`）に入れてはいけない。**
 * あれの呼び出し元は 3 か所あり、**1 つは 401 の自動ログアウト**である
 * ——**トークンが 30 日で切れただけ**の人は、何も押していない。
 * そこで消すと、**押していない人の書きかけが黙って消える。**
 * 消してよいのは「退会」を押した経路だけなので、**関数を分けてある。**
 *
 * **「あとで読む」（`cy-saved-story-ids`）はここで消さない。**
 * あれは読む側の記録で、アカウントとは別のものである
 * （`/data-policy/` の「自分で外したとき」を真のままにする）。
 *
 * 名前を「device」ではなく「interview」にしてあるのは、
 * **入れ物の名前にすると、関係ない鍵を足したくなる**ため。
 * 中身の名前なら、**関係ないものを入れた時点で名前が嘘になる。**
 *
 * `server/device-storage.test.mjs` が、**ここで消す鍵の集合**と
 * `DEVICE_STORAGE` の「退会したとき」の記載を突き合わせる。
 */
export function clearInterviewWriting() {
  removeValue(INTERVIEW_DRAFT_KEY)
  removeValue(INTERVIEW_PROGRESS_KEY)
}

function readInterviewDraft(removeAfterRead: boolean): InterviewDraft | null {
  try {
    const raw = readValue(INTERVIEW_DRAFT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<InterviewDraft>
    if (typeof value.title !== 'string' || typeof value.body !== 'string' || typeof value.hurdleText !== 'string') {
      removeValue(INTERVIEW_DRAFT_KEY)
      return null
    }
    if (removeAfterRead) removeValue(INTERVIEW_DRAFT_KEY)
    return {
      title: value.title.slice(0, 80),
      body: value.body.slice(0, 8000),
      hurdleText: value.hurdleText.slice(0, 200),
    }
  } catch {
    try {
      removeValue(INTERVIEW_DRAFT_KEY)
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

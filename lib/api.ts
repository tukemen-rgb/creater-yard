/**
 * API クライアント。ブラウザから server/api.mjs を呼ぶための薄い層。
 *
 * 本番は同一オリジン（リバースプロキシで /api を API サーバーへ寄せる）を
 * 想定していて、その場合の base は空文字。開発中だけ Next の dev サーバー
 * （:3000）と API（:8798）が別ポートになるので、そのときは API 側へ向ける
 * （API 側も CY_ALLOW_ORIGIN で明示的に開ける必要がある）。
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (typeof window !== 'undefined' && window.location.port === '3000'
    ? 'http://localhost:8798'
    : '')

export type Account = {
  id: string
  handle: string
  createdAt: string
  contact: string
}

export type StoryImage = {
  id: string
  ext: 'png' | 'jpg' | 'webp'
  width: number
  height: number
}

export type Story = {
  id: string
  authorHandle: string
  title: string
  body: string
  tools: string[]
  toolTags: string[]
  topicTags: string[]
  hurdle: {
    text: string
    status: 'open' | 'resolved'
  } | null
  gameUrl: string
  image: StoryImage | null
  status: 'public' | 'draft'
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type StoryListing = {
  stories: Story[]
  total: number
  page: number
  totalPages: number
}

/**
 * タグ索引。**件数は持たない。**公開カウンタと件数順は組み合わさると
 * 実質的な人気ランキングになる（経営判断 2026-08-10 20:00）。
 * 数えた値をそもそも外へ出さないため、型からも落としてある。
 */
export type TagIndex = {
  tools: string[]
  topics: string[]
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * ログイン状態は localStorage に持つ。
 * トークンは HMAC 署名つき・30 日期限・パスワード変更で失効（auth.mjs）。
 */
const TOKEN_KEY = 'cy-token'
const HANDLE_KEY = 'cy-handle'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getHandle(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(HANDLE_KEY)
}

export function saveSession(token: string, account: Account) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(HANDLE_KEY, account.handle)
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(HANDLE_KEY)
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.auth) {
    const token = getToken()
    if (!token) throw new ApiError('この操作にはログインが必要です。', 401)
    headers.authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(
      'サーバーに接続できません。時間をおいてもう一度お試しください。',
      0,
    )
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* JSON でない応答は下の分岐で扱う */
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `エラーが発生しました（${res.status}）。`
    // 認証切れならセッションを片付ける。切れたトークンを持ち続けると、
    // 画面は「ログイン中」の顔のまま操作だけが失敗し続ける
    if (res.status === 401 && options.auth && typeof window !== 'undefined') {
      clearSession()
    }
    throw new ApiError(message, res.status)
  }
  return data as T
}

/** 検査済み画像の URL。SSR でも使うので API_BASE を経由する。 */
export function imageUrl(image: StoryImage): string {
  return `${API_BASE}/api/images/${image.id}.${image.ext}`
}

/**
 * 画像のアップロード（検査つき）。本文の JSON とは別送 — multipart を
 * 自前でパースするより、生のバイト列 1 本のほうが検査もエラーの伝え方も
 * 単純になる。
 */
export async function uploadImage(
  file: File,
): Promise<{ image: StoryImage; warnings: string[] }> {
  const token = getToken()
  if (!token) throw new ApiError('この操作にはログインが必要です。', 401)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/story-image`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': file.type || 'application/octet-stream',
        // ファイル名はヘッダに ASCII しか置けないので、非 ASCII は落とす。
        // 拡張子と中身の食い違い警告に使うだけで、保存名には使わない
        'x-filename': file.name.replace(/[^\x20-\x7e]/g, '_'),
      },
      body: file,
    })
  } catch {
    throw new ApiError('サーバーに接続できません。時間をおいてもう一度お試しください。', 0)
  }
  const data = (await res.json().catch(() => null)) as
    | { image: StoryImage; warnings: string[] }
    | { error: string }
    | null
  if (!res.ok || !data || !('image' in data)) {
    const message =
      data && 'error' in data ? data.error : `画像を保存できませんでした（${res.status}）。`
    throw new ApiError(message, res.status)
  }
  return data
}

/** 記事の日付表示。時刻まで出すほどの精度は要らない。 */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

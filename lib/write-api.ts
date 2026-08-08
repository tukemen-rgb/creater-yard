/**
 * 書く側 API のクライアント。
 *
 * 基底 URL は NEXT_PUBLIC_WRITE_API。未設定のビルドでは「書く機能は準備中」
 * として振る舞う（GAMEYARD の scan-client と同じ、無効を隠さない方式）。
 *
 * トークンは localStorage に置く。静的配信の本体と API が別オリジンになる
 * 構成では cookie の SameSite の扱いが面倒になるため（GAMEYARD の選択を
 * 引き継ぐ。第三者 JS を入れない決まりが XSS 側の土台）。
 */
export const WRITE_API_BASE = (process.env.NEXT_PUBLIC_WRITE_API ?? '').replace(/\/$/, '')

const TOKEN_KEY = 'cy.token'

export function isConfigured(): boolean {
  return WRITE_API_BASE !== ''
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

export type Account = { id: string; handle: string; createdAt: string }

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ account: Account; token?: string }> {
  if (!isConfigured()) throw new Error('書く機能は準備中です。')
  const res = await fetch(`${WRITE_API_BASE}${path}`, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? '通信に失敗しました。')
  return body
}

function postJson(payload: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

export async function register(handle: string, password: string): Promise<Account> {
  const body = await call('/api/auth/register', postJson({ handle, password }))
  setToken(body.token ?? null)
  return body.account
}

export async function login(handle: string, password: string): Promise<Account> {
  const body = await call('/api/auth/login', postJson({ handle, password }))
  setToken(body.token ?? null)
  return body.account
}

/** ログイン中なら自分を返す。トークンが無い・切れているときは null。 */
export async function me(): Promise<Account | null> {
  const token = getToken()
  if (!token || !isConfigured()) return null
  try {
    const body = await call('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    return body.account
  } catch {
    return null
  }
}

export function logout() {
  setToken(null)
}

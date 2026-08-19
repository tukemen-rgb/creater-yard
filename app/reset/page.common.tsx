'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { api, ApiError, saveSession, type Account } from '../../lib/api'
import { DEVICE_STORAGE_WRITE_FAILED } from '../../lib/device-storage'

/**
 * パスワード再設定。?t= が無ければ要求フォーム、あればメールのリンクから
 * 来た確認フォーム。要求への応答はハンドルの実在にかかわらず同じ文言
 * （API 側で揃えている）。メール送信が未設定の環境では API が 503 で
 * 「使えない」と明示するので、それをそのまま見せる。
 */
function ResetInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('t') ?? ''

  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitLockRef = useRef(false)
  /**
   * 再設定の受け付けが動いているか（設計 U-10）。
   *
   * ①が実物を歩いたら、**押して初めて「準備が完了していない」と断られた。**
   * 断り自体は誠実（受け付けたふりをしない）だが、**入れなくなった人に
   * ハンドルを打たせてから言っている。**
   *
   * `/api/health` は註釈に「**UI が事前に確認する**」と書いてある経路で、
   * まさにこの用途。**取れなかったときは黙る** —— 死活が読めないことを
   * 理由にフォームを止めると、受け付けは動いているのに使えない人が出る。
   */
  const [mailReady, setMailReady] = useState<boolean | null>(null)
  useEffect(() => {
    api<{ mail?: boolean }>('/api/health')
      .then((data) => setMailReady(data.mail !== false))
      .catch(() => setMailReady(null))
  }, [])

  const request = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitLockRef.current) return
    submitLockRef.current = true
    setBusy(true)
    setError('')
    try {
      const data = await api<{ message: string }>('/api/auth/reset', {
        method: 'POST',
        body: { handle },
      })
      setMessage(data.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '受け付けられませんでした。')
      submitLockRef.current = false
      setBusy(false)
    }
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitLockRef.current) return
    submitLockRef.current = true
    setBusy(true)
    setError('')
    try {
      const data = await api<{ account: Account; token: string }>('/api/auth/reset/confirm', {
        method: 'POST',
        body: { token, password },
      })
      // 再設定できた＝本人確認は済んでいる。そのままログイン状態にする。
      // ただし端末に残せなければ進まない（U-13）。**下の catch に渡す**ので、
      // ロックを解く場所は 1 つのままにする。
      if (!saveSession(data.token, data.account)) {
        throw new ApiError(DEVICE_STORAGE_WRITE_FAILED, 0)
      }
      router.push('/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '再設定できませんでした。')
      submitLockRef.current = false
      setBusy(false)
    }
  }

  if (token) {
    return (
      <div className="page page--narrow auth-page">
        <h1>新しいパスワードを設定</h1>
        <div className="auth-panel">
          <form className="form" onSubmit={confirm}>
            <label className="form__field">
              新しいパスワード（10 文字以上）
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                autoComplete="new-password"
                required
              />
            </label>
            {error && <p className="notice notice--error" role="alert">{error}</p>}
            <button type="submit" className="button auth-panel__submit" disabled={busy}>
              {busy ? '設定中…' : 'パスワードを設定する'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--narrow auth-page">
      <h1>パスワード再設定</h1>
      <p className="page__lede">
        登録時にメールアドレスを設定している場合、再設定用のリンクを送ります。
      </p>
      {mailReady === false && (
        <p className="notice">
          いまはまだ、再設定の受け付けを開けていません。押しても受け付けられないので、先にお伝えします。
        </p>
      )}
      <div className="auth-panel">
        {message ? (
          <p className="notice" role="status">{message}</p>
        ) : (
          <form className="form" onSubmit={request}>
            <label className="form__field">
              ハンドル
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            {error && <p className="notice notice--error" role="alert">{error}</p>}
            <button type="submit" className="button auth-panel__submit" disabled={busy}>
              {busy ? '送信中…' : '再設定リンクを要求する'}
            </button>
          </form>
        )}
        <nav className="auth-panel__links" aria-label="パスワード再設定の補助メニュー">
          <Link prefetch={false} href="/login/">ログインへ戻る</Link>
        </nav>
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <ResetInner />
    </Suspense>
  )
}

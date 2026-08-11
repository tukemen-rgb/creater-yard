'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { api, ApiError, saveSession, type Account } from '../../lib/api'

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

  const request = async (e: React.FormEvent) => {
    e.preventDefault()
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
    }
    setBusy(false)
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ account: Account; token: string }>('/api/auth/reset/confirm', {
        method: 'POST',
        body: { token, password },
      })
      // 再設定できた＝本人確認は済んでいる。そのままログイン状態にする
      saveSession(data.token, data.account)
      router.push('/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '再設定できませんでした。')
      setBusy(false)
    }
  }

  if (token) {
    return (
      <div className="page page--narrow">
        <h1>新しいパスワードを設定</h1>
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
          {error && <p className="notice notice--error">{error}</p>}
          <div className="form__actions">
            <button type="submit" className="button" disabled={busy}>
              パスワードを設定する
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="page page--narrow">
      <h1>パスワード再設定</h1>
      <p className="page__lede">
        登録時にメールアドレスを設定している場合、再設定用のリンクを送ります。
      </p>
      {message ? (
        <p className="notice">{message}</p>
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
          {error && <p className="notice notice--error">{error}</p>}
          <div className="form__actions">
            <button type="submit" className="button" disabled={busy}>
              再設定リンクを要求する
            </button>
          </div>
        </form>
      )}
      <p className="notice">
        <Link prefetch={false} href="/login/">← ログインへ戻る</Link>
      </p>
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

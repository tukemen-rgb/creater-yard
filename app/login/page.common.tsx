'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { api, ApiError, saveSession, type Account } from '../../lib/api'
import { hasInterviewDraft } from '../../lib/story-interview'

export default function LoginPage() {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ account: Account; token: string }>('/api/auth/login', {
        method: 'POST',
        body: { handle, password },
      })
      saveSession(data.token, data.account)
      router.push(hasInterviewDraft() ? '/write/?restore=interview' : '/stories/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ログインできませんでした。')
      setBusy(false)
    }
  }

  return (
    <div className="page page--narrow auth-page">
      <h1>ログイン</h1>
      <div className="auth-panel">
        <form className="form" onSubmit={submit}>
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
          <label className="form__field">
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <button type="submit" className="button auth-panel__submit" disabled={busy}>
            {busy ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <nav className="auth-panel__links" aria-label="ログインの補助メニュー">
          <Link prefetch={false} href="/signup/">アカウントを新しく作る</Link>
          <Link prefetch={false} href="/reset/">パスワードを再設定する</Link>
        </nav>
      </div>
    </div>
  )
}

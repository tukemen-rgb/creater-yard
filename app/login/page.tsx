'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { api, ApiError, saveSession, type Account } from '../../lib/api'

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
      router.push('/stories/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ログインできませんでした。')
      setBusy(false)
    }
  }

  return (
    <div className="page page--narrow">
      <h1>ログイン</h1>
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
        {error && <p className="notice notice--error">{error}</p>}
        <div className="form__actions">
          <button type="submit" className="button" disabled={busy}>
            ログイン
          </button>
        </div>
      </form>
      <p className="notice">
        アカウントがまだの人は <Link prefetch={false} href="/signup/">新規登録</Link> へ。
      </p>
    </div>
  )
}

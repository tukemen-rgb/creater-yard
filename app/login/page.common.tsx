'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { api, ApiError, saveSession, type Account } from '../../lib/api'
import { hasInterviewDraft } from '../../lib/story-interview'

export default function LoginPage() {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitLockRef = useRef(false)
  /**
   * ヒアリングの答えを持ったまま、ここへ来た人か（設計 U-7）。
   * signup の同じ註釈と対にすること —— **片方だけ直すと、既にアカウントを
   * 持っている人だけが置き去りになる。**見るのは画面が出たあと（静的書き出しの
   * 事前描画には端末の保存領域が無い）。
   */
  const [fromInterview, setFromInterview] = useState(false)
  useEffect(() => setFromInterview(hasInterviewDraft()), [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitLockRef.current) return
    submitLockRef.current = true
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
      submitLockRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="page page--narrow auth-page">
      <h1>ログイン</h1>
      {fromInterview && (
        <p className="notice">
          さっき答えた内容はこの端末に残っています。ログインすると、そのまま続きから書けます。
        </p>
      )}
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
            {busy ? 'ログイン中…' : fromInterview ? 'ログインして続きへ' : 'ログイン'}
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

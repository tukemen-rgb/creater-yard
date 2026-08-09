'use client'
/**
 * ログイン。成功したら「ログイン中」を表示する（me の確認を兼ねる）。
 * 専用のマイページは Story 実装の番で作る。
 */
import { useEffect, useState } from 'react'

import { isConfigured, login, logout, me } from '../../lib/write-api'

export default function LoginPage() {
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [current, setCurrent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    me().then((account) => setCurrent(account?.handle ?? null))
  }, [])

  if (!isConfigured()) {
    return (
      <div className="hero">
        <p className="eyebrow">準備中</p>
        <h1>ログイン</h1>
        <p className="hero__lede">書く機能はまだ準備中です。もう少しだけお待ちください。</p>
      </div>
    )
  }

  if (current) {
    return (
      <div className="hero">
        <p className="eyebrow">おかえりなさい</p>
        <h1>ログイン中</h1>
        <p className="hero__lede">
          ハンドル <strong>{current}</strong> でログインしています。
        </p>
        {/* 登録直後と同じ 2 本。ログアウトだけの行き止まりにしない（designs 11:21） */}
        <p className="plan__note">
          <a href="/write/">Story を書く</a> ／{' '}
          <a href={`/w/${current}/`}>自分のページを見る</a>
        </p>
        <button
          type="button"
          className="auth-form__secondary"
          onClick={() => {
            logout()
            setCurrent(null)
          }}
        >
          ログアウト
        </button>
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">書き手のかた</p>
      <h1>ログイン</h1>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            const account = await login(handle, password)
            setCurrent(account.handle)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'ログインに失敗しました。')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          ハンドル
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="auth-form__error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'ログインしています…' : 'ログインする'}
        </button>
      </form>
    </div>
  )
}

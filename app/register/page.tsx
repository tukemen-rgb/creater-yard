'use client'
/**
 * 書き手アカウントの登録。
 *
 * 入力はハンドルとパスワードの 2 つだけ（proposals 2026-08-08 15:12）。
 * メール欄を置かないのは設計であって手抜きではないので、その旨を
 * 画面の文言で正直に伝える。
 */
import { useState } from 'react'

import { isConfigured, register } from '../../lib/write-api'

export default function RegisterPage() {
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!isConfigured()) {
    return (
      <div className="hero">
        <p className="eyebrow">準備中</p>
        <h1>登録</h1>
        <p className="hero__lede">書く機能はまだ準備中です。もう少しだけお待ちください。</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="hero">
        <p className="eyebrow">ようこそ</p>
        <h1>登録できました</h1>
        <p className="hero__lede">
          ハンドル <strong>{done}</strong> で登録しました。このままログイン状態です。
        </p>
        {/* 一番意図が強い場面なので、次の一手をその場に出す（designs 11:21） */}
        <p className="plan__note">
          <a href="/write/">最初の 1 本を書く</a> ／{' '}
          <a href={`/w/${done}/`}>自分のページを見る</a>
        </p>
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">書き手になる</p>
      <h1>登録</h1>
      <p className="hero__lede">
        必要なのはハンドルとパスワードだけ。メールアドレスは不要です
        （あとから設定でき、使い道はパスワード再設定だけです）。
      </p>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            const account = await register(handle, password)
            setDone(account.handle)
          } catch (err) {
            setError(err instanceof Error ? err.message : '登録に失敗しました。')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          ハンドル（英小文字・数字・-・_ の 3〜32 文字）
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          パスワード（10 文字以上）
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p className="auth-form__error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? '登録しています…' : '登録する'}
        </button>
      </form>
    </div>
  )
}

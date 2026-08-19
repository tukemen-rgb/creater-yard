'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { api, ApiError, saveSession, type Account } from '../../lib/api'
import { hasInterviewDraft } from '../../lib/story-interview'

/**
 * 新規登録。ハンドル＋パスワードだけ。メールは任意（SPEC §1）。
 * 集めない理由も画面で正直に言う（隠さない文化はここから始まる）。
 */
export default function SignupPage() {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitLockRef = useRef(false)
  /**
   * ヒアリングの答えを持ったまま、ここへ送られてきた人か（設計 U-7）。
   *
   * 答えは端末に残っていて、登録が終われば全部戻る。**それを画面が
   * 言っていなかった。**書き手の側には確かめる手段が無く、「登録しないと
   * 消えるのでは」と思う理由だけがあった（事例 74・NN/g
   * 「情報が無いことは、制御が無いことと同じ」）。
   *
   * **見るのは画面が出たあと。**静的書き出しの事前描画には端末の保存領域が
   * 無いので、描画中に見ると出来上がった HTML と食い違う
   * （components/edit-link.tsx と同じ形）。
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
      const data = await api<{ account: Account; token: string }>('/api/auth/register', {
        method: 'POST',
        body: { handle, password, contact },
      })
      saveSession(data.token, data.account)
      router.push(hasInterviewDraft() ? '/write/?restore=interview' : '/write/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登録できませんでした。')
      submitLockRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="page page--narrow auth-page">
      <h1>新規登録</h1>
      <p className="page__lede">
        必要なのはハンドルとパスワードだけ。あなたの記録はあなたのもので、
        いつでも全部消せます。
      </p>
      {fromInterview && (
        <p className="notice">
          さっき答えた内容はこの端末に残っています。登録が終わると、そのまま続きから書けます。
        </p>
      )}
      <div className="auth-panel">
        <form className="form" onSubmit={submit}>
          <label className="form__field">
            ハンドル（英小文字・数字・ハイフン・アンダースコアの 3〜32 文字）
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              pattern="[a-z0-9][a-z0-9_\-]{2,31}"
              autoComplete="username"
              required
            />
          </label>
          <label className="form__field">
            パスワード（10 文字以上）
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>

          <details className="optional-fields">
            <summary>メールアドレスを登録する（任意）</summary>
            <div className="optional-fields__body">
              <label className="form__field">
                メールアドレス
                <input
                  type="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <p className="form__hint">
                パスワードを忘れたときの再設定にだけ使います。
              </p>
            </div>
          </details>

          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <button type="submit" className="button auth-panel__submit" disabled={busy}>
            {/* ヒアリングから来た人は、もう書いている。その人に「書き始める」と
                言うのは、起きたことと違う（設計 U-7） */}
            {busy ? '登録中…' : fromInterview ? '登録して続きへ' : '登録して書き始める'}
          </button>
        </form>

        <nav className="auth-panel__links" aria-label="新規登録の補助メニュー">
          <Link prefetch={false} href="/login/">すでにアカウントがある人はログイン</Link>
        </nav>
      </div>
    </div>
  )
}

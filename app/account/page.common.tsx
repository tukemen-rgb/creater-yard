'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  api,
  ApiError,
  clearSession,
  getHandle,
  saveSession,
  type Account,
  type Story,
} from '../../lib/api'
import { StoryCard } from '../../components/story-card'

/**
 * 自分のページ。下書きを含む自分の Story と、アカウントの操作。
 * 退会は Story ごと消える（記録は本人のもの）。それを画面でも先に言う。
 */
export default function AccountPage() {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [mine, setMine] = useState<Story[] | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!getHandle()) {
      router.replace('/login/')
      return
    }
    api<{ account: Account }>('/api/auth/me', { auth: true })
      .then((data) => setAccount(data.account))
      .catch(() => router.replace('/login/'))
    api<{ stories: Story[] }>('/api/mine', { auth: true })
      .then((data) => setMine(data.stories))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [router])

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api<{ account: Account; token: string }>('/api/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        auth: true,
      })
      // パスワード変更で古いトークンは全部切れる。新しいものに差し替える
      saveSession(data.token, data.account)
      setMessage('パスワードを変更しました。他の端末ではログインし直しになります。')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '変更できませんでした。')
    }
    setBusy(false)
  }

  const logout = () => {
    clearSession()
    router.push('/stories/')
  }

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    const count = mine?.length ?? 0
    if (
      !window.confirm(
        `退会すると、あなたの Story ${count} 件もすべて消えます。元に戻せません。よろしいですか？`,
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await api<{ ok: boolean }>('/api/auth/me', {
        method: 'DELETE',
        body: { password: deletePassword },
        auth: true,
      })
      clearSession()
      router.push('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '退会できませんでした。')
      setBusy(false)
    }
  }

  if (!account) return <p className="notice">読み込み中…</p>

  const drafts = (mine ?? []).filter((s) => s.status === 'draft')
  const published = (mine ?? []).filter((s) => s.status === 'public')

  return (
    <div className="page">
      <h1>{account.handle} のページ</h1>
      <p className="page__lede">
        <Link prefetch={false} href="/write/">新しい Story を書く</Link>
        {' ・ '}
        <Link prefetch={false} href={`/creators/${account.handle}/`}>
          公開ページを見る
        </Link>
        {' ・ '}
        <button type="button" className="linklike" onClick={logout}>
          ログアウト
        </button>
      </p>
      {message && <p className="notice">{message}</p>}
      {error && <p className="notice notice--error">{error}</p>}

      {drafts.length > 0 && (
        <section>
          <h2>下書き（あなたにだけ見えています）</h2>
          {drafts.map((story) => <StoryCard key={story.id} story={story} showAuthor={false} />)}
        </section>
      )}

      <section>
        <h2>公開した Story</h2>
        {mine === null && <p className="notice">読み込み中…</p>}
        {mine !== null && published.length === 0 && (
          <p className="notice">
            まだありません。<Link prefetch={false} href="/write/">最初の 1 本を書く</Link>
          </p>
        )}
        {published.map((story) => <StoryCard key={story.id} story={story} showAuthor={false} />)}
        {mine !== null && published.length === 1 && drafts.length === 0 && (
          <p className="notice">
            最初の Story を公開できました。あとで状況が変わったときは、その変化だけでも
            2 本目になります。今すぐ書く必要はありません。{' '}
            <Link prefetch={false} href="/write/?from=first-story">
              その後を書く
            </Link>
          </p>
        )}
      </section>

      <section className="account-box">
        <h2>パスワード変更</h2>
        <form className="form" onSubmit={changePassword}>
          <label className="form__field">
            いまのパスワード
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="form__field">
            新しいパスワード（10 文字以上）
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>
          <div className="form__actions">
            <button type="submit" className="button" disabled={busy}>
              変更する
            </button>
          </div>
        </form>
      </section>

      <section className="account-box account-box--danger">
        <h2>退会</h2>
        <p>
          アカウントと、あなたの Story のすべてが消えます。記録はあなたのものなので、
          引き止めのための手続きは置きません。同じハンドルは、なりすまし防止のため
          しばらく再登録できません。
        </p>
        <form className="form" onSubmit={deleteAccount}>
          <label className="form__field">
            確認のためパスワード
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <div className="form__actions">
            <button type="submit" className="button button--danger" disabled={busy}>
              退会して全部消す
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

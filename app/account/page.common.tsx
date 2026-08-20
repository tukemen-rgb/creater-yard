'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
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
import { DEVICE_STORAGE_WRITE_FAILED } from '../../lib/device-storage'
import { clearInterviewWriting } from '../../lib/story-interview'
import { StoryCard } from '../../components/story-card'

/**
 * 自分のページ。下書きを含む自分の Story と、アカウントの操作。
 * 退会は Story ごと消える（記録は本人のもの）。それを画面でも先に言う。
 */
export default function AccountPage() {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [mine, setMine] = useState<Story[] | null>(null)
  const [mineError, setMineError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [busy, setBusy] = useState(false)
  const accountActionLockRef = useRef(false)

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
      .catch((err: unknown) => {
        const detail = err instanceof ApiError ? err.message : '読み込めませんでした。'
        setMineError(`Story の読み込みに失敗しました。${detail}`)
      })
  }, [router])

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (accountActionLockRef.current) return
    accountActionLockRef.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api<{ account: Account; token: string }>('/api/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        auth: true,
      })
      // パスワード変更で古いトークンは全部切れる。新しいものに差し替える。
      // 差し替えられなければ、この端末では次の操作から入り直しになる（U-13）
      const kept = saveSession(data.token, data.account)
      setMessage(
        kept
          ? 'パスワードを変更しました。他の端末ではログインし直しになります。'
          : 'パスワードは変更しました。ただし' + DEVICE_STORAGE_WRITE_FAILED,
      )
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '変更できませんでした。')
    } finally {
      accountActionLockRef.current = false
      setBusy(false)
    }
  }

  const logout = () => {
    if (accountActionLockRef.current) return
    clearSession()
    router.push('/stories/')
  }

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (accountActionLockRef.current) return
    accountActionLockRef.current = true
    const count = mine?.length ?? 0
    if (
      !window.confirm(
        `退会すると、あなたの Story ${count} 件もすべて消えます。元に戻せません。よろしいですか？`,
      )
    ) {
      accountActionLockRef.current = false
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
      // **サーバーが消えてから端末**（U-18）。先に端末を消すと、削除が
      // 失敗したときに「書きかけだけ失って退会もできていない」になる。
      // ログアウト（上）では呼ばない —— 戻ってくる人の書きかけは残す。
      clearInterviewWriting()
      router.push('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '退会できませんでした。')
      accountActionLockRef.current = false
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
        <button type="button" className="linklike" disabled={busy} onClick={logout}>
          ログアウト
        </button>
      </p>
      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="notice notice--error" role="alert">{error}</p>}

      {drafts.length > 0 && (
        <section>
          <h2>下書き（あなたにだけ見えています）</h2>
          {/* 下書きは読み物ではなく、書きかけである（設計 A-4）。
              カードの題名はプレビューへ行くので、そのままでは続きを書くのに
              「題名 → プレビュー → 編集する」の 2 手かかっていた。
              書く側へ 1 手で戻る道を、ここに置く。

              **StoryCard には足さない。**あの部品は公開の一覧でも使われて
              いるので、足すと他人の記録の下にも出る（I-11 で StoryArticle に
              足しかけたのと同じ形）。 */}
          {drafts.map((story) => (
            <div key={story.id} className="account__draft">
              <StoryCard story={story} showAuthor={false} />
              <p className="account__draft-actions">
                <Link prefetch={false} href={`/write/?id=${story.id}`}>
                  続きを書く
                </Link>
              </p>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>公開した Story</h2>
        {mine === null && !mineError && <p className="notice">読み込み中…</p>}
        {mineError && (
          <p className="notice notice--error" role="alert">
            {mineError}{' '}
            <button type="button" className="linklike" onClick={() => window.location.reload()}>
              再読み込み
            </button>
          </p>
        )}
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
              {/* 「全部消す」と書かない（U-18）。退会のあとも「あとで読む」は
                  端末に残る。**「全部」はその 1 つのぶんだけ嘘になる。** */}
              退会して Story も画像も消す
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

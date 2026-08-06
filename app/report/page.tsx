'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { api, ApiError } from '../../lib/api'

/**
 * 通報フォーム。アカウントなしで出せる（権利者に会員登録を求めない）。
 * 受け付けても自動では何も止まらない — 判断は運営が行い、ここは受付番号を
 * 返すところまで。
 */
const CATEGORIES = [
  ['copyright', '著作権・権利侵害'],
  ['inappropriate', '不適切な内容'],
  ['privacy', '個人情報・プライバシー'],
  ['spam', 'スパム・宣伝'],
  ['other', 'その他'],
] as const

function ReportInner() {
  const params = useSearchParams()
  const storyId = params.get('story') ?? ''

  const [target, setTarget] = useState(storyId ? `/story/${storyId}/` : '')
  const [category, setCategory] = useState<string>('copyright')
  const [detail, setDetail] = useState('')
  const [contact, setContact] = useState('')
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ticket: string }>('/api/reports', {
        method: 'POST',
        body: { target, category, detail, contact },
      })
      setTicket(data.ticket)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '送信できませんでした。')
    }
    setBusy(false)
  }

  if (ticket) {
    return (
      <div className="page page--narrow">
        <h1>通報を受け付けました</h1>
        <p className="notice">
          受付番号: <strong>{ticket}</strong>
          <br />
          お問い合わせの際はこの番号をお伝えください。運営が内容を確認し、
          必要な対応を判断します（受付によって自動で公開が止まることはありません）。
        </p>
      </div>
    )
  }

  return (
    <div className="page page--narrow">
      <h1>問題を通報する</h1>
      <p className="page__lede">
        権利侵害・不適切な内容などの申し立てに、アカウントは要りません。
      </p>
      <form className="form" onSubmit={submit}>
        <label className="form__field">
          対象（Story の URL・ID・書き手のハンドルなど）
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </label>
        <label className="form__field">
          種別
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="form__field">
          内容（10 文字以上。判断の材料になります）
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={8}
            required
          />
        </label>
        <label className="form__field">
          連絡先（任意。対応結果の連絡が必要な場合）
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </label>
        {error && <p className="notice notice--error">{error}</p>}
        <div className="form__actions">
          <button type="submit" className="button" disabled={busy}>
            通報する
          </button>
        </div>
      </form>
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <ReportInner />
    </Suspense>
  )
}

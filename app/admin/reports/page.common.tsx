'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { api, ApiError, formatDate, getHandle } from '../../../lib/api'

/**
 * 通報の一覧（運営のみ）。運営かどうかはサーバー側（CY_ADMIN_HANDLES）が
 * 判定し、運営でなければ 404 が返る — 画面側では隠さない・偽らない。
 */
type Report = {
  id: string
  ticket: string
  target: string
  category: string
  detail: string
  contact: string
  status: string
  note: string
  createdAt: string
}

type Listing = {
  reports: Report[]
  categories: Record<string, string>
  statuses: Record<string, string>
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setListing(await api<Listing>('/api/reports', { auth: true }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '読み込めませんでした。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getHandle()) {
      router.replace('/login/')
      return
    }
    load()
  }, [load, router])

  const setStatus = async (report: Report, status: string) => {
    setBusyId(report.id)
    setError('')
    try {
      await api(`/api/reports/${report.id}`, { method: 'POST', body: { status }, auth: true })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新できませんでした。')
    }
    setBusyId('')
  }

  if (!listing && loading) return <p className="notice">読み込み中…</p>
  if (!listing) {
    return (
      <div className="page">
        <p className="notice notice--error" role="alert">{error}</p>
        <button type="button" className="button button--ghost" onClick={load}>
          再読み込み
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>通報の一覧</h1>
      {error && (
        <div className="notice notice--error" role="alert">
          <p>{error}</p>
          <button type="button" className="button button--ghost" onClick={load}>
            再読み込み
          </button>
        </div>
      )}
      {loading && <p className="notice" role="status">読み込み中…</p>}
      {listing.reports.length === 0 && <p className="notice">通報はありません。</p>}
      {listing.reports.map((report) => (
        <article key={report.id} className="story-card">
          <h2 className="story-card__title">
            {report.ticket}
            <span className="badge badge--draft">{listing.statuses[report.status] ?? report.status}</span>
          </h2>
          <p className="story-card__meta">
            {listing.categories[report.category] ?? report.category}
            {' ・ '}
            {formatDate(report.createdAt)}
            {' ・ 対象: '}
            {report.target}
          </p>
          <p className="story-card__excerpt">{report.detail}</p>
          {report.contact && <p className="story-card__meta">連絡先: {report.contact}</p>}
          <div className="form__actions">
            {Object.entries(listing.statuses).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={value === report.status ? 'button' : 'button button--ghost'}
                disabled={Boolean(busyId) || loading || value === report.status}
                onClick={() => setStatus(report, value)}
              >
                {label}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}

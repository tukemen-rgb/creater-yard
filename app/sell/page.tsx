'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  api,
  ApiError,
  getHandle,
  OFFER_TYPE_LABELS,
  type Offer,
  type OfferType,
} from '../../lib/api'

/**
 * 出品する・直す。?id= があれば編集。write ページと同じ型。
 * 決済に関する欄はない — 価格は自由記述の表示、支払いは外部リンク先。
 */
function SellInner() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id') ?? ''

  const [type, setType] = useState<OfferType>('skill')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priceLabel, setPriceLabel] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!editId)

  useEffect(() => {
    if (!getHandle()) {
      router.replace('/login/')
      return
    }
    if (!editId) return
    api<{ offer: Offer }>(`/api/offers/${editId}.json`, { auth: true })
      .then(({ offer }) => {
        if (offer.authorHandle !== getHandle()) {
          setError('この出品を編集できるのは本人だけです。')
          return
        }
        setType(offer.type)
        setTitle(offer.title)
        setBody(offer.body)
        setPriceLabel(offer.priceLabel)
        setExternalUrl(offer.externalUrl)
        setLoaded(true)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [editId, router])

  const save = async (status: 'public' | 'draft') => {
    setBusy(true)
    setError('')
    const payload = { type, title, body, priceLabel, externalUrl, status }
    try {
      const data = editId
        ? await api<{ offer: Offer }>(`/api/offers/${editId}`, { method: 'PUT', body: payload, auth: true })
        : await api<{ offer: Offer }>('/api/offers', { method: 'POST', body: payload, auth: true })
      router.push(status === 'public' ? `/offer/${data.offer.id}/` : '/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存できませんでした。')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editId) return
    if (!window.confirm('この出品を取り下げます。元に戻せません。よろしいですか？')) return
    setBusy(true)
    try {
      await api<{ ok: boolean }>(`/api/offers/${editId}`, { method: 'DELETE', auth: true })
      router.push('/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '取り下げられませんでした。')
      setBusy(false)
    }
  }

  if (!loaded && !error) return <p className="notice">読み込み中…</p>

  return (
    <div className="page page--narrow">
      <h1>{editId ? '出品を直す' : '出品する'}</h1>
      <p className="page__lede">
        スキル・Recipe・テンプレート・Mentor 相談を並べられます。
        購入・依頼・支払いはあなたの外部リンク先（Booth・Stripe・自サイト等）で
        行われ、CreatorYard は決済に関与しません。
      </p>
      {error && <p className="notice notice--error">{error}</p>}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save('public')
        }}
      >
        <label className="form__field">
          種別
          <select value={type} onChange={(e) => setType(e.target.value as OfferType)}>
            {Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="form__field">
          タイトル
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="例: ドット絵のキャラクター描きます（16×16〜32×32）"
            required
          />
        </label>
        <label className="form__field">
          説明
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            maxLength={4000}
            placeholder="できること・納期・進め方など。実績は Story へのリンクで見せるのが確実です。"
          />
        </label>
        <label className="form__field">
          価格の表示（自由記述。例: ¥3,000〜 / 応相談 / 無料）
          <input
            type="text"
            value={priceLabel}
            onChange={(e) => setPriceLabel(e.target.value)}
            maxLength={40}
          />
        </label>
        <label className="form__field">
          外部リンク（https のみ。購入・依頼はここで受ける）
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…（Booth・ココナラ・自サイトなど）"
          />
        </label>
        <div className="form__actions">
          <button type="button" className="button" disabled={busy} onClick={() => save('public')}>
            公開する
          </button>
          <button type="button" className="button button--ghost" disabled={busy} onClick={() => save('draft')}>
            下書き保存
          </button>
          {editId && (
            <button type="button" className="button button--danger" disabled={busy} onClick={remove}>
              取り下げる
            </button>
          )}
        </div>
      </form>
      <p className="notice">
        公開すると<Link prefetch={false} href="/market/">マーケット</Link>とあなたの個人ページに載ります。
      </p>
    </div>
  )
}

export default function SellPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <SellInner />
    </Suspense>
  )
}

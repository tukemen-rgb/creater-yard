'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { api, ApiError, getHandle, type Offer } from '../../lib/api'
import { OfferArticle } from '../../components/offer-article'

/**
 * 出品の下書きプレビュー（/offer/?id=）。story の下書きプレビューと同じ型。
 * 公開済みの ID は実 URL（/offer/<id>/）へ送る。
 */
function OfferInner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''

  const [offer, setOffer] = useState<Offer | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('出品が指定されていません。')
      return
    }
    api<{ offer: Offer }>(`/api/offers/${id}.json`, { auth: Boolean(getHandle()) })
      .then((data) => {
        if (data.offer.status === 'public') {
          router.replace(`/offer/${data.offer.id}/`)
          return
        }
        setOffer(data.offer)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [id, router])

  if (error) {
    return (
      <div className="page">
        <p className="notice notice--error">{error}</p>
        <p>
          <Link prefetch={false} href="/market/">← 出品一覧へ</Link>
        </p>
      </div>
    )
  }
  if (!offer) return <p className="notice">読み込み中…</p>
  return <OfferArticle offer={offer} />
}

export default function OfferPreviewPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <OfferInner />
    </Suspense>
  )
}

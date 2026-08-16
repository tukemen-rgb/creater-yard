'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { api, ApiError, OFFER_TYPE_LABELS, type OfferListing } from '../../lib/api'
import { OfferCard } from '../../components/offer-card'
import { Pager } from '../../components/pager'

/**
 * 出品一覧（static モード。ブラウザから API を読む版）。
 * server モード用は page.server.tsx。文言を変えるときは両方を直すこと。
 */
function MarketInner() {
  const params = useSearchParams()
  const type = params.get('type') ?? ''
  const page = params.get('page') ?? '1'

  const [listing, setListing] = useState<OfferListing | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = new URLSearchParams({ page })
    if (type) query.set('type', type)
    api<OfferListing>(`/api/offers.json?${query}`)
      .then(setListing)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [type, page])

  const pageHref = (n: number) => `/market/?${type ? `type=${type}&` : ''}page=${n}`

  return (
    <div className="page">
      <h1>マーケット</h1>
      <p className="page__lede">
        つくる人のスキル・Recipe・テンプレート・Mentor 相談。
        購入や依頼は各出品の外部リンク先で行われます（このサイトは決済を持ちません）。
      </p>
      <p className="story-card__tags">
        <Link prefetch={false} className={type ? 'tag' : 'tag tag--topic'} href="/market/">すべて</Link>
        {Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => (
          <Link
            prefetch={false}
            key={value}
            className={type === value ? 'tag tag--topic' : 'tag'}
            href={`/market/?type=${value}`}
          >
            {label}
          </Link>
        ))}
      </p>
      {error && <p className="notice notice--error">{error}</p>}
      {!error && !listing && <p className="notice">読み込み中…</p>}
      {listing && listing.offers.length === 0 && (
        <p className="notice">
          まだ出品がありません。
          <Link prefetch={false} href="/sell/">最初の 1 件を出しませんか。</Link>
        </p>
      )}
      {listing?.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
      {listing && (
        <Pager
          page={listing.page}
          totalPages={listing.totalPages}
          prevHref={pageHref(listing.page - 1)}
          nextHref={pageHref(listing.page + 1)}
        />
      )}
    </div>
  )
}

export default function MarketPage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <MarketInner />
    </Suspense>
  )
}

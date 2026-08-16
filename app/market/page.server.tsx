import type { Metadata } from 'next'
import Link from 'next/link'

import { OfferCard } from '../../components/offer-card'
import { Pager } from '../../components/pager'
import { OFFER_TYPE_LABELS, type OfferType } from '../../lib/api'
import { publishedOffers } from '../../lib/offers-read'

/**
 * 出品一覧（server モード）。スキル・Recipe・テンプレート・Mentor の陳列。
 * 決済は持たない — 購入・依頼は各出品の外部リンク先（D-CY4）。
 * static モード用は page.static.tsx。文言を変えるときは両方を直すこと。
 */
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ type?: string; page?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { type } = await searchParams
  const label = type && type in OFFER_TYPE_LABELS ? OFFER_TYPE_LABELS[type as OfferType] : ''
  return {
    title: label ? `${label}の出品` : 'マーケット',
    description: 'ゲームを作る人のスキル・Recipe・テンプレート・Mentor 相談。購入や依頼は本人の外部リンク先で。',
  }
}

export default async function MarketPage({ searchParams }: Props) {
  const { type = '', page } = await searchParams
  const listing = publishedOffers({ page: Number(page) || 1, type })
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
      {listing.offers.length === 0 && (
        <p className="notice">
          まだ出品がありません。
          <Link prefetch={false} href="/sell/">最初の 1 件を出しませんか。</Link>
        </p>
      )}
      {listing.offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
      <Pager
        page={listing.page}
        totalPages={listing.totalPages}
        prevHref={pageHref(listing.page - 1)}
        nextHref={pageHref(listing.page + 1)}
      />
    </div>
  )
}

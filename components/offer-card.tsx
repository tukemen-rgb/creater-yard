import Link from 'next/link'

import { formatDate, OFFER_TYPE_LABELS, type Offer } from '../lib/api'

/** 出品の 1 枚。種別と価格表示つき。数字の競争がないのは Story と同じ。 */
export function OfferCard({ offer, showAuthor = true }: { offer: Offer; showAuthor?: boolean }) {
  const excerpt = offer.body.length > 120 ? `${offer.body.slice(0, 120)}…` : offer.body
  const href = offer.status === 'draft' ? `/offer/?id=${offer.id}` : `/offer/${offer.id}/`
  return (
    <article className="story-card">
      <h2 className="story-card__title">
        <span className="badge badge--type">{OFFER_TYPE_LABELS[offer.type]}</span>{' '}
        <Link prefetch={false} href={href}>
          {offer.title}
        </Link>
        {offer.status === 'draft' && <span className="badge badge--draft">下書き</span>}
      </h2>
      <p className="story-card__meta">
        {showAuthor && (
          <>
            <Link prefetch={false} href={`/creators/${offer.authorHandle}/`}>
              {offer.authorHandle}
            </Link>
            {' ・ '}
          </>
        )}
        {formatDate(offer.publishedAt ?? offer.updatedAt)}
        {offer.priceLabel && (
          <>
            {' ・ '}
            <strong>{offer.priceLabel}</strong>
          </>
        )}
      </p>
      {excerpt && <p className="story-card__excerpt">{excerpt}</p>}
    </article>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { OfferArticle } from '../../../components/offer-article'
import { OFFER_TYPE_LABELS } from '../../../lib/api'
import { publishedOffer } from '../../../lib/offers-read'

/** 出品の実 URL（/offer/<id>/）。story-page.tsx と同じ型。 */
type Props = { params: Promise<{ id: string }> }

function excerpt(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const offer = publishedOffer(id)
  if (!offer) return {}
  return {
    title: `${offer.title}（${OFFER_TYPE_LABELS[offer.type]}）`,
    description: excerpt(offer.body),
  }
}

export default async function OfferPage({ params }: Props) {
  const { id } = await params
  const offer = publishedOffer(id)
  if (!offer) notFound()
  return <OfferArticle offer={offer} />
}

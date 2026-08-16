import type { Metadata } from 'next'
import { SITE_OG, alternatesFor, handleFeedPath, handleUrl } from '../../../lib/og'
import { notFound } from 'next/navigation'

import { StoryCard } from '../../../components/story-card'
import { OfferCard } from '../../../components/offer-card'
import { Pager } from '../../../components/pager'
import { publishedOffers } from '../../../lib/offers-read'
import { creatorStories } from '../../../lib/stories-read'

/**
 * 書き手の実 URL（/creators/<handle>/）。その人の公開 Story が時系列で
 * 並ぶ（Timeline の原型）。
 *
 * 実在の判定は「公開 Story があるか」で行う。アカウントの存在は明かさない
 * — ハンドルの総当たり調査に使われるし、まだ何も書いていない人のページを
 * 出しても空の部屋を見せるだけになる。
 */
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/

type Props = {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  if (!HANDLE_RE.test(handle) || creatorStories(handle).total === 0) return {}
  const canonical = handleUrl(handle)
  const description = `${handle} の制作記録（Creator Story）。`
  return {
    title: `${handle} の記録`,
    description,
    // 作者ページの alternate は**その作者の RSS**（全体 RSS ではない）
    alternates: alternatesFor(canonical, handleFeedPath(handle)),
    openGraph: {
      ...SITE_OG,
      title: `${handle} の記録`,
      description,
      type: 'profile',
      ...(canonical ? { url: canonical } : {}),
    },
  }
}

export default async function CreatorPage({ params, searchParams }: Props) {
  const { handle } = await params
  const { page } = await searchParams
  if (!HANDLE_RE.test(handle)) notFound()
  const listing = creatorStories(handle, Number(page) || 1)
  const offerListing = publishedOffers({ handle })
  // 実在の判定は「公開している何か」があるかで行う（Story か出品）
  if (listing.total === 0 && offerListing.total === 0) notFound()

  return (
    <div className="page">
      <h1 className="creator-page__title">{handle} の記録</h1>
      {offerListing.total > 0 && (
        <section className="tag-section">
          <h2>出品</h2>
          {offerListing.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} showAuthor={false} />
          ))}
        </section>
      )}
      {listing.total > 0 && listing.page === 1 && offerListing.total > 0 && <h2>Story</h2>}
      {listing.stories.map((story) => (
        <StoryCard key={story.id} story={story} showAuthor={false} />
      ))}
      {/* この作者の RSS への**見えるリンク**。全体 RSS ではない。 */}
      <p className="notice">
        {handle} の新着を追うなら{' '}
        <a href={handleFeedPath(handle)}>RSS で受け取れます</a>
        （登録は要りません）。
      </p>
      <Pager
        page={listing.page}
        totalPages={listing.totalPages}
        prevHref={`/creators/${handle}/?page=${listing.page - 1}`}
        nextHref={`/creators/${handle}/?page=${listing.page + 1}`}
      />
    </div>
  )
}

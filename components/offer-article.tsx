import Link from 'next/link'

import { formatDate, OFFER_TYPE_LABELS, type Offer } from '../lib/api'
import { OfferEditLink } from './offer-edit-link'

/**
 * 出品の本文表示。実 URL ページ（SSR）と下書きプレビューの両方から使う。
 *
 * 外部リンクは rel="nofollow noopener ugc" ＋ドメイン併記。リンク先の
 * 信用をサイトが肩代わりしないし、被リンクを売り物にもさせない。
 * 決済はリンク先の話であることを、ボタンの手前で毎回明示する。
 */
export function OfferArticle({ offer }: { offer: Offer }) {
  let host = ''
  try {
    host = new URL(offer.externalUrl).hostname
  } catch {
    /* 下書きで未入力の場合 */
  }
  return (
    <article className="page story">
      <p className="story__back">
        <Link prefetch={false} href="/market/">← 出品一覧</Link>
      </p>
      <h1 className="story__title">
        <span className="badge badge--type">{OFFER_TYPE_LABELS[offer.type]}</span>{' '}
        {offer.title}
        {offer.status === 'draft' && <span className="badge badge--draft">下書き</span>}
      </h1>
      <p className="story__meta">
        <Link prefetch={false} href={`/creators/${offer.authorHandle}/`}>
          {offer.authorHandle}
        </Link>
        {' ・ '}
        {formatDate(offer.publishedAt ?? offer.updatedAt)}
        {offer.priceLabel && (
          <>
            {' ・ '}
            <strong>{offer.priceLabel}</strong>
          </>
        )}
        <OfferEditLink id={offer.id} authorHandle={offer.authorHandle} />
      </p>
      <div className="story__body">{offer.body}</div>
      {offer.externalUrl && (
        <div className="offer-external">
          <a
            className="button"
            href={offer.externalUrl}
            rel="nofollow noopener ugc"
            target="_blank"
          >
            外部サイトで見る（{host}）
          </a>
          <p className="offer-external__note">
            購入・依頼・支払いはリンク先（本人の外部サービス）で行われます。
            CreatorYard は決済を持たず、取引には関与しません。
          </p>
        </div>
      )}
      <p className="story__report">
        <Link prefetch={false} href={`/report/?story=${offer.id}`}>
          この出品の問題を通報する
        </Link>
      </p>
    </article>
  )
}

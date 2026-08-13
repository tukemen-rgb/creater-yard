import Link from 'next/link'

/** ページ送り。前後の href を文字列で受け取る（server/client どちらからも使える）。 */
export function Pager({
  page,
  totalPages,
  prevHref,
  nextHref,
}: {
  page: number
  totalPages: number
  prevHref: string
  nextHref: string
}) {
  if (totalPages <= 1) return null
  return (
    <nav className="pager" aria-label="ページ送り">
      {page > 1 && (
        <Link prefetch={false} href={prevHref}>
          ← 前のページ
        </Link>
      )}
      <span className="pager__state">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link prefetch={false} href={nextHref}>
          次のページ →
        </Link>
      )}
    </nav>
  )
}

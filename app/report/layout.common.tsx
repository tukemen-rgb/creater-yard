import type { Metadata } from 'next'

import { absoluteUrl, alternatesFor, ogWithUrl } from '../../lib/og'

/**
 * 通報の面のカード（設計 A-3）。
 *
 * `page.common.tsx` は `'use client'` なので `metadata` を export できない。
 * **層（layout）は server 部品なので持てる。**フォームの中身は 1 行も
 * 触らずに、貼られたときの見え方だけを直せる。
 */
const canonical = absoluteUrl('/report/')
const title = '問題を通報する'
const description = 'CreatorYard で見つけた問題を運営へ知らせる。アカウントは要りません。'

export const metadata: Metadata = {
  title,
  description,
  alternates: alternatesFor(canonical),
  openGraph: { ...ogWithUrl(canonical, 'website'), title, description },
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children
}

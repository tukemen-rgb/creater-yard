import type { Metadata } from 'next'

import { absoluteUrl, alternatesFor, ogWithUrl } from '../../lib/og'

/**
 * タグの面のカード（設計 A-3）。
 *
 * **層に置くのは、2 つのモードで同じものを配るため。**
 * static モードの `page.static.tsx` は `'use client'` なので `metadata` を
 * 持てず、server モードの `page.server.tsx` だけが持っていた。**同じ URL が、
 * どちらで配られるかで違うカードになっていた**（③が両方を焼いて測った）。
 *
 * いま本番は nginx が `/tags/` を必ず server へ回すので実害は出ていないが、
 * **それは設定に依存していて、コードでは守られていない。**層に置けば
 * どちらのモードでも同じになる。
 */
const canonical = absoluteUrl('/tags/')
const title = 'タグから探す'
const description = 'ツール名と「どこでつまずいたか」で制作記録を探す。'

export const metadata: Metadata = {
  title,
  description,
  alternates: alternatesFor(canonical),
  openGraph: { ...ogWithUrl(canonical, 'website'), title, description },
}

export default function TagsLayout({ children }: { children: React.ReactNode }) {
  return children
}

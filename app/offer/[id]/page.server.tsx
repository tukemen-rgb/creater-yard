/**
 * 出品の実 URL（server モード用のルート設定）。story/[id] と同じ理由で
 * static モード用ファイルは置かない（出品は公開のたびに増える）。
 */
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export { generateMetadata, default } from './offer-page'

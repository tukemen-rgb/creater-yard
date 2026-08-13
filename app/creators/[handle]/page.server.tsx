/**
 * 書き手ページ（server モード用のルート設定）。
 *
 * 書き手は公開のたびに増えるので、ビルド時に列挙できる集合ではない。
 * static モード用のファイルは置かず、静的ホスティング単体で動かす場合は
 * 前段のプロキシで /creators/ 以下を server モードへ回す。
 */
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export { generateMetadata, default } from './creator-page'

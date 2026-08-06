/**
 * Story 実 URL（server モード用のルート設定）。
 *
 * 事前生成はせず、リクエスト時に組み立てて結果もキャッシュしない
 * （`force-dynamic`）。キャッシュすると本人が直しても古いページが出続ける。
 * 読むのは数 KB の JSON 1 件なので毎回でも十分に軽い。
 *
 * static モード用のファイルは**置いていない**。Story は公開のたびに増える
 * ので、ビルド時に列挙できる集合ではない（`output: 'export'` は空の
 * generateStaticParams を持つ動的ルートを受け付けない）。静的ホスティング
 * 単体で動かす場合、/story/ 以下は前段のプロキシで server モードへ回すこと。
 */
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export { generateMetadata, default } from './story-page'

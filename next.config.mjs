/**
 * CreatorYard の Next.js 設定。GAMEYARD と同じ 2 モード方式。
 *
 *   SITE_MODE=static（既定） … `output: 'export'` で静的書き出し（out/）。
 *                              固定ページ（トップ・ログイン等）の配信用
 *   SITE_MODE=server         … Node サーバーとして動かす。Story の本文・
 *                              一覧・書き手ページをリクエスト時に組み立てる
 *
 * 分けている理由は GAMEYARD と同じで、公開を即時にするため。静的書き出し
 * だけだと新しい Story のページはフルビルドまで存在しない。前段（nginx
 * など）は静的ファイルがあればそれを返し、無いパス（/story/ /creators/
 * /stories/ /tags/ /api/）を server モードのプロセスへ回す。
 */
const serverMode = process.env.SITE_MODE === 'server'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: serverMode ? undefined : 'export',
  /**
   * モードごとにルート設定を差し替えるための仕組み（GAMEYARD と同じ）。
   *
   * `dynamicParams` や `dynamic` は Next.js が静的解析で読むためリテラル
   * しか書けず、`output: 'export'` は `dynamicParams: true` を受け付けない。
   * そこでページ本体は共有し、ルート設定だけを page.server.tsx /
   * page.static.tsx に分けて、採用する拡張子をここで切り替える。
   * 採用されなかった側のファイルはページとして認識されない。
   * server モードにしか置いていないルート（/story/[id]/ など）は、
   * static モードでは存在しない扱いになる。
   */
  pageExtensions: serverMode
    ? ['server.tsx', 'tsx', 'ts']
    : ['static.tsx', 'tsx', 'ts'],
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig

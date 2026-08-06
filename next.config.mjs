/**
 * CreatorYard の Next.js 設定。GAMEYARD と同じ 2 モード方式。
 *
 *   SITE_MODE=static（既定） … `output: 'export'` で静的書き出し（out/）
 *   SITE_MODE=server         … Node サーバーとして動かす（書く側の画面用）
 *
 * MVP の間はほぼ静的のみ。server モードは Story 投稿画面を動的に返す
 * 段になってから使う。
 */
const serverMode = process.env.SITE_MODE === 'server'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: serverMode ? undefined : 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig

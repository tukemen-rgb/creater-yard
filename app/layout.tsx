import type { Metadata } from 'next'
import Link from 'next/link'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CreatorYard — つくる人を、育てる。',
    template: '%s | CreatorYard',
  },
  description:
    'ゲームを作る人が、制作の記録を残し、知見を分かち合い、仲間とつながる場所。GAMEYARD の姉妹サービス。',
  // サイト共通の OGP（designs 21:22 段階 B）。og:url と og:image は
  // ドメインとブランド素材が決まってから足す（どちらも人待ち）。
  // Story 固有の OGP は静的焼き込み（公開運用）の設計で扱う
  // RSS の自動発見（rel=alternate は head に置く必要がある。事例 18）。
  // 公開 URL /stories/feed.xml は nginx が API へ対応させる
  alternates: {
    types: { 'application/rss+xml': '/stories/feed.xml' },
  },
  openGraph: {
    title: 'CreatorYard — つくる人を、育てる。',
    description:
      'ゲームを作る人が、制作の記録を残す場所。完成していなくていい。数字で競わない。',
    type: 'website',
    siteName: 'CreatorYard',
    locale: 'ja_JP',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <div className="container site-header__inner">
            <Link prefetch={false} href="/" className="brand">
              <span className="brand__mark">⚒</span>
              CreatorYard
              <span className="brand__tag">つくる人を、育てる。</span>
            </Link>
            {/*
              ログイン状態で出し分けない。出し分けると layout に 'use client' が
              要り、全ページがクライアント描画に倒れる（designs 11:21）。
              未ログインで「書く」を押した人は /write/ の
              「ログインが必要です」に着き、そこから登録できる。
            */}
            <nav className="site-nav" aria-label="メインナビゲーション">
              <a href="/stories/">制作記録</a>
              <a href="/write/">書く</a>
              <a href="https://play-game-yard.com/">GAMEYARD</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p>
              CreatorYard は <a href="https://play-game-yard.com/">GAMEYARD</a>{' '}
              の姉妹サービスです。作品を届けるのが GAMEYARD、つくる人が育つのが
              CreatorYard。
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}

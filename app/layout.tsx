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
            <nav className="site-nav" aria-label="メインナビゲーション">
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

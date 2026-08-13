import type { Metadata } from 'next'
import Link from 'next/link'

import './globals.css'
import { NavAuth } from '../components/nav-auth'
import { SITE_OG, alternatesFor } from '../lib/og'

export const metadata: Metadata = {
  title: {
    default: 'CreatorYard — つくる人を、育てる。',
    template: '%s | CreatorYard',
  },
  description:
    'ゲームを作る人が、制作の記録を残し、知見を分かち合い、仲間とつながる場所。GAMEYARD の姉妹サービス。',
  // 全体 RSS の autodiscovery。canonical はページごとに違うのでここでは出さない
  // （null を渡すと types だけが入る）。
  alternates: alternatesFor(null),
  // og:site_name と og:locale をサイト全体の既定にする。**子で openGraph を
  // 書くときは必ず ...SITE_OG を展開すること** — metadata は浅くマージされるので、
  // 展開を忘れるとこの 2 つが子ページで消える（段階 A-6 で実際に踏んだ）。
  openGraph: { ...SITE_OG, type: 'website' },
  // 初回パイロット中は、URLを知る読者が未登録で読める状態を保ちつつ、
  // 検索結果への恒久的な露出は止める。実利用確認後に別判断で解除する。
  robots: {
    index: false,
    follow: false,
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
            <nav className="site-nav" aria-label="メインナビゲーション">
              <Link prefetch={false} href="/stories/">Story</Link>
              <Link prefetch={false} href="/saved/">保存したStory</Link>
              <Link prefetch={false} href="/tags/">タグ</Link>
              <a href="https://play-game-yard.com/">GAMEYARD</a>
              <NavAuth />
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
            <p className="site-footer__links">
              <Link prefetch={false} href="/guidelines/">この場所の決まり</Link>
              {' ・ '}
              <Link prefetch={false} href="/data-policy/">データの扱い</Link>
              {' ・ '}
              <Link prefetch={false} href="/report/">問題を通報する</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}

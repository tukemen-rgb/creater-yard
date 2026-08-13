import Link from 'next/link'

/**
 * トップページ。MVP（Creator Story）が動くようになったので、
 * 「できること」を実際の入口つきで案内する。まだ無い機能
 * （Guild・Mentor 等）は並べない。
 */
export default function Home() {
  return (
    <div className="hero">
      <h1>
        <span className="hero__line">つくる過程に、</span>
        <span className="hero__line">居場所を。</span>
      </h1>
      <p className="hero__lede">
        CreatorYard は、ゲームを作る人のための場所です。完成した作品は{' '}
        <a href="https://play-game-yard.com/">GAMEYARD</a>{' '}
        へ。ここには、完成までの記録（Creator Story）が残ります。
      </p>
      <p className="hero__actions">
        <Link prefetch={false} href="/stories/" className="button">
          Story を読む
        </Link>
        <Link prefetch={false} href="/write/?mode=interview" className="button button--ghost">
          書き始める
        </Link>
      </p>
      <section className="plan">
        <h2>いまできること</h2>
        <ul>
          <li>
            <strong>Creator Story</strong> — 制作の記録を時系列で残す。
            作りかけ・つまずき・工夫、ぜんぶ主役。下書き保存もできます。
          </li>
          <li>
            <strong>つまずきタグ</strong> — ツール名とつまずきで
            <Link prefetch={false} href="/tags/">記録が探せる</Link>。
            あなたの遠回りが、誰かの近道になる。
          </li>
          <li>
            <strong>使ったツールを隠さない</strong> — AI を含めて、
            何で作ったかを普通に書ける場所です。
          </li>
        </ul>
        <p className="plan__note">
          順位表・称号・数字の競争は、ここにはありません（GAMEYARD と同じ
          決まりです）。
        </p>
      </section>
    </div>
  )
}

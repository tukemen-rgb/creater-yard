/**
 * トップページ（準備中の告知）。
 *
 * MVP（Creator Story）が動くまでの間、何を作っている場所かだけを
 * 正直に伝える。実在しない機能を「ある顔」で並べない。
 */
export default function Home() {
  return (
    <div className="hero">
      <p className="eyebrow">準備中</p>
      <h1>
        <span className="hero__line">つくる過程に、</span>
        <span className="hero__line">居場所を。</span>
      </h1>
      <p className="hero__lede">
        CreatorYard は、ゲームを作る人のための場所です。完成した作品は{' '}
        <a href="https://play-game-yard.com/">GAMEYARD</a>{' '}
        へ。ここには、完成までの記録（Creator Story）が残ります。
      </p>
      <section className="plan">
        <h2>最初にできるようになること</h2>
        <ul>
          <li>
            <strong>Creator Story</strong> — 制作の記録を時系列で残す。
            作りかけ・つまずき・工夫、ぜんぶ主役。
          </li>
          <li>
            <strong>つまずきタグ</strong> — ツール名とつまずきで記録が
            探せる。あなたの遠回りが、誰かの近道になる。
          </li>
          <li>
            <strong>使ったツールを隠さない</strong> — AI を含めて、
            何で作ったかを普通に書ける場所にする。
          </li>
        </ul>
        <p className="plan__note">
          順位表・称号・数字の競争は、ここにはありません（GAMEYARD と同じ
          決まりです）。<a href="/stories/">新着の制作記録を見る</a>
        </p>
      </section>
    </div>
  )
}

import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import HeroVideo from './hero-video'

/**
 * トップページ。MVP（Creator Story）が動くようになったので、
 * 「できること」を実際の入口つきで案内する。まだ無い機能
 * （Guild・Mentor 等）は並べない。
 *
 * 背景動画（Issue #12）は「素材ゲート」方式: ビルド時に
 * public/media/hero.mp4 の存在を確認し、無ければ video 要素ごと出さない。
 * 壊れた video 要素や第三者 URL を本番へ出さない、を仕組みで守るため。
 * 素材を置いて再ビルドするだけで背景動画が現れる（コード変更不要）。
 */
const MEDIA_DIR = path.join(process.cwd(), 'public', 'media')
const rightsApproved = fs.existsSync(path.join(MEDIA_DIR, 'RIGHTS_APPROVED'))
const hasHeroVideo = rightsApproved && fs.existsSync(path.join(MEDIA_DIR, 'hero.mp4'))
const hasHeroWebm = fs.existsSync(path.join(MEDIA_DIR, 'hero.webm'))

export default function Home() {
  return (
    <>
      <div className={hasHeroVideo ? 'hero hero--video' : 'hero'}>
        {hasHeroVideo && (
          <HeroVideo hasWebm={hasHeroWebm} />
        )}
        <div className="hero__content">
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
        </div>
      </div>

      {/* 「いまできること」は動画の上ではなくページの地の上に置く。映像に
          重ねた説明は、読むためではなく飾るために在るように見えてしまう。 */}
      <section className="plan">
        <h2 className="plan__title">いまできること</h2>
        {/* 箇条書き＋強調＋ダッシュの並びは、どのサービスにもある「生成された
            一覧」の形になっていた（社長指摘）。説明する言葉には見出しと本文の
            役割があるので、dl で役割を分ける。装飾で差を出さず、字の大きさと
            行間と 1 本の罫線で差を出す（デジタル庁デザインシステムの考え方）。 */}
        <dl className="plan__list">
          <div className="plan__item">
            <dt>Creator Story</dt>
            <dd>
              制作の記録を時系列で残せます。作りかけ・つまずき・工夫、
              ぜんぶ主役。下書きのまま置いておくこともできます。
            </dd>
          </div>
          <div className="plan__item">
            <dt>つまずきタグ</dt>
            <dd>
              ツール名とつまずきで{' '}
              <Link prefetch={false} href="/tags/">記録が探せます</Link>。
              あなたの遠回りが、誰かの近道になります。
            </dd>
          </div>
          <div className="plan__item">
            <dt>使ったツールを隠さない</dt>
            <dd>
              AI を含めて、何で作ったかを普通に書ける場所です。
              隠さなくていいことが、ここの決まりです。
            </dd>
          </div>
        </dl>
        <p className="plan__note">
          順位表・称号・数字の競争は、ここにはありません（GAMEYARD と同じ
          決まりです）。
        </p>
      </section>
    </>
  )
}

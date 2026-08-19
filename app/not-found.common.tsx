import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * 見つからなかったときの面（設計 U-9）。
 *
 * **ここは例外の面ではない。**この場所は書き手が「いつでも全部消せます」と
 * 約束しており（登録の面にそう書いてある）、**消えた記録の URL が外に
 * 残るのは普通のこと**である。配った先で切れたリンクを踏むのは、
 * 事故ではなく仕様の裏側にあたる。
 *
 * 直す前に実物を測った（2026-08-19・本番）。**404 が 2 通りあった。**
 *
 *   /story/<無い ID>/  … `notFound()` → Next の既定のエラーの殻
 *                        （`id="__next_error__"`）。返る HTML の中に
 *                        押せるリンクが **RSS 1 本しか無い**
 *   /no-such-page/     … 静的側。header と footer が描かれていて
 *                        押せるリンクが **8 本**
 *
 * どちらも本文は `This page could not be found.` の 1 行で、**英語**だった。
 * しかも切れやすいのは前者 —— 消された Story の URL がまさにそれである。
 *
 * `not-found.common.tsx` という名前なのは、`next.config.mjs` の
 * `pageExtensions` が **2 モードとも `common.tsx` を採る**ため。
 * **`not-found.tsx` と名付けると、どちらのモードでも拾われず、
 * 黙って英語の既定に戻る**（試験でそこを縛っている）。
 */
export const metadata: Metadata = {
  title: '見つかりませんでした',
}

export default function NotFound() {
  return (
    <div className="page page--narrow">
      <h1>その記録は見つかりませんでした</h1>
      <p className="page__lede">
        URL が違っているか、書き手がその記録を消したか、公開をやめたのだと思います。
      </p>
      <p>
        CreatorYard は、書いた人が自分の記録をいつでも消せる場所です。
        消えていること自体は、おかしなことではありません。
      </p>
      <nav className="not-found__exits" aria-label="ここから行ける場所">
        <p>
          <Link prefetch={false} href="/stories/">ほかの人の記録を読む</Link>
        </p>
        <p>
          <Link prefetch={false} href="/tags/">道具やつまずきから探す</Link>
        </p>
        <p>
          <Link prefetch={false} href="/saved/">保存した Story を見る</Link>
        </p>
      </nav>
    </div>
  )
}

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../components/story-card.tsx', import.meta.url), 'utf8')

/**
 * U-1「一覧のカードに、その Story の画像を出す」（設計 2026-08-18 22:30）。
 *
 * 制作記録は目で見るものなのに、一覧のカードは `story.image` を 1 度も
 * 参照していなかった。書き手が撮って、検査を通して、保存された画像が、
 * **記事には出るのに一覧にだけ出ない**状態だった。
 *
 * **書き手の側にも効く。**撮った写真が一覧に出ないと、書いた人は
 * 「載らないのか」と思って次から撮らなくなる。
 *
 * **この試験が守っていない範囲。**CSS は縛っていない。`.story-card__image`
 * の `max-height` を消しても、ここは全部緑のままである（設計の変異検査
 * 3 つ目がそう予告している）。**縦長の画像 1 枚でカードが伸びないことは、
 * 人がブラウザで見るしかない。**黙って落とさず、ここに書いておく。
 */

test('カードは Story の画像を出す', () => {
  assert.match(
    source,
    /story\.image/,
    '画像を参照していない。制作記録の一覧が文字だけになる',
  )
})

/**
 * **設計の変異検査が外していた 1 件**（③が 2026-08-18 22:50 に実測）。
 *
 * 設計は「`story.image &&` を `||` に変えれば試験 1 が赤くなる」と予告して
 * いたが、**赤くならなかった**。試験 1 は `story.image` という文字を探す
 * だけで、`&&` か `||` かを見ていない。`||` にすると **画像が無い Story でも
 * 枠を出そうとして `imageUrl(null)` に落ちる**。
 *
 * 守り方は狭く取る（`report-ui.test.mjs` と同じ方針）。ここで縛るのは
 * **「画像があるときだけ出す」という条件そのもの**である。
 */
test('カードは画像が無いときに画像の枠を出さない', () => {
  assert.match(
    source,
    /\{story\.image && \(/,
    '条件が && でないと、画像を持たない Story でも枠を出そうとして落ちる',
  )
})

test('カードは imageUrl() を通して URL を組み立てる', () => {
  assert.match(
    source,
    /imageUrl\(/,
    '生の文字列で URL を作ると API_BASE が外れ、static モードで画像が壊れる',
  )
})

/**
 * ここから 2 件は **一覧固有** の要件で、記事側（story-article.tsx）には無い。
 * 1 ページ最大 20 枚（STORY_LIMITS.perPage）を即時に取りに行くと、
 * **画像を持たない書き手の記録まで表示が遅れる**。
 */
test('カードの画像は画面に入るまで読み込まない', () => {
  assert.match(
    source,
    /loading="lazy"/,
    '20 枚を即時取得すると、画像の無い記録の表示まで遅れる',
  )
})

test('カードの画像は実寸を渡して、読み込み前の飛び跳ねを防ぐ', () => {
  assert.match(source, /width=\{story\.image\.width\}/, 'width が無いと読み込み前の高さが 0 になる')
  assert.match(source, /height=\{story\.image\.height\}/, 'height が無いと下のカードが飛び跳ねる')
})

test('カードは next/image を使わない', () => {
  assert.doesNotMatch(
    source,
    /from 'next\/image'/,
    'Next の Image は最適化サーバー前提。静的優先の構成（images.unoptimized）と食い違う',
  )
})

test('カードは自ホスト外の URL を持たない', () => {
  const refs = [...source.matchAll(/(?:href|src|action)="([^"]+)"/g)].map((m) => m[1])
  for (const ref of refs) {
    assert.doesNotMatch(ref, /^https?:/, `自ホスト外の参照: ${ref}`)
  }
})

/**
 * **消しすぎの防止。**上の 6 件は「画像を足したこと」しか縛らない。
 * 画像を足すついでに つまずき・タグ・抜粋 を削っても、6 件は緑のままである。
 * I-10 の試験で同じ形を学んだ（「消したこと」と「消しすぎていないこと」の両方）。
 *
 * とりわけ **つまずき**は、この場所の主役である。
 */
test('カードは つまずき・タグ・抜粋 を出すことをやめない', () => {
  assert.match(source, /story\.hurdle/, 'つまずきが消えている。この場所の主役である')
  assert.match(source, /乗り越えた/, 'つまずきの解決済みの表示が消えている')
  assert.match(source, /悩み中/, '未解決のまま置ける表示が消えている')
  assert.match(source, /story\.toolTags/, '道具タグが消えている')
  assert.match(source, /story\.topicTags/, '話題タグが消えている')
  assert.match(source, /excerpt/, '本文の抜粋が消えている')
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const link = await readFile(new URL('../components/write-next-link.tsx', import.meta.url), 'utf8')
const article = await readFile(new URL('../components/story-article.tsx', import.meta.url), 'utf8')
const account = await readFile(new URL('../app/account/page.common.tsx', import.meta.url), 'utf8')

/**
 * I-11「公開したあとの着地点に、次の 1 本への導線を出す」（設計 2026-08-17 16:30）。
 *
 * ②が①の提案から**真でない可能性のある部分を落とした**経緯が、この試験の
 * 形を決めている。①は `/account/` と同じ文をそのまま出すと書いたが、
 * あの文は「**最初の Story を公開できました**」で始まり、**公開が 1 本のとき
 * にしか真でない**。`/story/<id>/` はその数を持っておらず、持つには認証つきの
 * 通信を 1 本増やすことになる。
 *
 * > **1 文のために通信を足すのは割に合わない。**
 * > **そして数を持たないまま出せば「5 本目なのに最初と書く」ことになる。**
 * > **それは I-10 で消したばかりの形である。**
 *
 * だから**残すのはリンクの語だけ**にした。「その後を書く」は何本目でも真で、
 * リンク先が出す文（前の Story から変わったこと…）も何本目でも真である。
 */

test('本人以外には出さない', () => {
  assert.match(link, /getHandle\(\) === authorHandle/, '本人判定が無い')
  assert.match(link, /if \(!mine\) return null/, '他人にも描画してしまう')
  assert.match(link, /'use client'/, 'サーバーは閲覧者を知らない。描画後に見るしかない')
})

/**
 * **下書きのプレビューに出してはいけない。**`StoryArticle` は
 * `app/story/[id]/story-page.tsx`（公開ページ）と
 * `app/story/page.common.tsx`（下書きプレビュー）の**2 か所**から使われる。
 * **未公開のものを見ながら「その後を書く」は筋が通らない。**
 */
test('下書きには出さない', () => {
  assert.match(
    article,
    /\{story\.status === 'public' && <WriteNextLink/,
    '公開の条件で囲っていない。下書きプレビューにも出る',
  )
})

/**
 * **新しい文言を作らない**は設計の約束なので、機械で縛る。
 * `/account/` 側と**同じ語・同じリンク先**であることを、**2 ファイルを
 * 突き合わせて**確かめる（I-9 で決めた形）。
 *
 * `from=first-story` という名前は紛らわしいが、**出る文は一般的**である。
 * **名前を変えないこと** —— `/account/` 側と揃わなくなる。
 */
test('新しい文言を作らず、/account/ と同じ語・同じリンク先を使う', () => {
  for (const [label, source] of [['部品', link], ['/account/', account]]) {
    assert.match(source, /その後を書く/, `${label}: 語が違う`)
    assert.match(source, /from=first-story/, `${label}: リンク先が違う`)
  }
})

/**
 * **数を数えない・出さない。**この部品が数を持たないことが、
 * ②の判断の根拠そのものである。持ってしまえば「最初の Story」を
 * 出したくなり、I-10 で消した形へ戻る。
 */
test('数を数えない・出さない', () => {
  assert.doesNotMatch(link, /\/api\/mine/, '数を取りに行っている')
  assert.doesNotMatch(link, /length ===/, '数を数えている')
  assert.doesNotMatch(link, /最初の Story/, '真でない可能性のある文を置いている')
})

test('既存の導線を消していない', () => {
  assert.match(article, /<EditLink/, '編集するが消えている')
  assert.match(article, /<CopyOwnStoryLink/, 'リンクの複製が消えている')
  assert.match(article, /<SaveStory/, '保存が消えている')
})

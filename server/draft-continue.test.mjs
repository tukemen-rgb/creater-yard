/**
 * 下書きから、書く側へ 1 手で戻れる（設計 A-4・2026-08-19 13:50）。
 *
 * ①が実物を歩いて測った。下書きを保存すると `/account/` に着き、そこに
 * 下書きは**ちゃんと出ている**。ところが**そこから編集へ直接行くリンクは
 * 0 本**で、続きを書くには題名 → 下書きのプレビュー → 「編集する」と
 * **2 手**かかる。
 *
 * **下書きは読み物ではなく、書きかけである。**読むほうへだけ繋がっていて、
 * 書くほうへは 1 手多い、という形になっていた。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

const account = await read('app/account/page.common.tsx')
const card = await read('components/story-card.tsx')
const write = await read('app/write/page.common.tsx')

// **鍵の名前を実物から取る。**③は最初 `?edit=` と書いて実装し、試験にも
// 同じ `?edit=` を書いたので**緑のまま通った**。書く面が読んでいるのは
// `params.get('id')` で、`?edit=` は何も渡していなかった。
// **ソース検査は「自分が思った形になっているか」しか見ない。**
// 捕まえたのはブラウザで実物を開いた確認だけだった。
//
// だからここでは、**書く面が実際に読んでいる鍵の名前**と突き合わせる。
test('下書きの欄から、編集へ 1 手で行ける（鍵の名前は書く面と同じ）', () => {
  const key = /params\.get\('(\w+)'\) \?\? ''/.exec(write)?.[1]
  assert.ok(key, '書く面がどの鍵を読んでいるか分からない')
  const section = account.slice(account.indexOf('下書き（あなたにだけ'), account.indexOf('公開した Story'))
  assert.ok(
    section.includes(`/write/?${key}=`),
    `下書きから編集への導線が無い（書く面が読むのは ?${key}=）`,
  )
  assert.match(section, /続きを書く/, '何をする導線なのか名前が無い')
})

// StoryCard は公開の一覧でも使われている。共有部品に足すと、他人の記録の
// 下にも「続きを書く」が出る（I-11 で StoryArticle に足しかけた形と同じ）。
test('共有部品を汚さない（一覧のカードには足さない）', () => {
  assert.doesNotMatch(card, /\/write\/\?id=/, 'カードに編集の導線を足している')
})

// 公開済みの記録の編集は、記事側の「編集する」が持っている。ここにも出すと
// 同じことをする導線が 2 つになる。
test('公開した Story の欄には足さない', () => {
  const published = account.slice(account.indexOf('公開した Story'))
  assert.doesNotMatch(published, /続きを書く/, '公開の欄にも導線を足している')
})

/**
 * ページ送りの**部品**（`components/pager.tsx`）。
 *
 * PR #51 で「どの記録が何ページ目に入るか」は実行で縛った。**出す側は
 * 誰も見ていなかった** —— ③が 2026-08-19 に画面 35 本を 1 本ずつ空の部品に
 * 置き換えて試験一式を走らせたところ、**10 本はどの試験も見ておらず**、
 * この部品もその 1 本だった。空にしても 229 件が緑のまま通る。
 *
 * つまり **2 ページ目へ行く手段が画面から消えても、誰も気づかない。**
 * 溜まった記録が読まれるかどうかは、ここ 1 か所にかかっている。
 *
 * **ここはソース検査で、実行ではない。**tsx を `node --test` から描けない
 * （描くには React を持ち込むことになり、依存を増やさない決まりに触れる）。
 * だから**縛るのは条件の向きそのもの**にする —— この部品の壊れ方は
 * 「`>` を `>=` にする」であって、「識別子が消える」ではない。
 * **最後に確かめるのはブラウザ。**
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const pager = read('components/pager.tsx')

test('1 ページしか無いときは、ページ送りを出さない', () => {
  assert.match(
    pager,
    /if \(totalPages <= 1\) return null/,
    '1 ページのときに「1 / 1」を出してしまう（出す意味が無い）',
  )
})

// 1 ページ目に「前」を出すと、押した先が 0 ページ目になる。
test('「前」は 1 ページ目より後ろでだけ出す', () => {
  assert.match(pager, /\{page > 1 && \(/, '「前」の条件が page > 1 でない')
})

// 最終ページに「次」を出すと、押した先が範囲外になる（丸められて同じ面に
// 戻るだけだが、読み手には「進んだのに変わらない」と見える）。
test('「次」は最終ページより手前でだけ出す', () => {
  assert.match(pager, /\{page < totalPages && \(/, '「次」の条件が page < totalPages でない')
})

test('いま何ページ目かを出している', () => {
  assert.match(pager, /\{page\}[\s\S]{0,12}\{totalPages\}/, '現在地と総数を出していない')
})

/**
 * 呼び出し側の行き先。**ファイルの一覧は書き写さない** —— `<Pager` を
 * 使っている面を探して、見つかった全部を見る。
 *
 * 壊れ方は「前と次に同じ式を渡す」「前で +1 する」で、どちらもページが
 * 進まない・戻らないだけなので**画面は壊れて見えない。**
 */
function callers() {
  const found = []
  for (const f of globSync('app/**/*.tsx', { cwd: ROOT })) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const use = src.match(/<Pager[\s\S]*?\/>/)
    if (use) found.push([f, use[0]])
  }
  return found
}

test('ページ送りを使っている面が、前へ 1 つ・次へ 1 つ進む先を渡している', () => {
  const found = callers()
  assert.ok(found.length > 0, '<Pager> を使っている面が 1 つも見つからない')
  for (const [name, use] of found) {
    // **組み立て方は縛らない。**呼び出し側は行き先を直接書くことも
    // （`/creators/…/?page=${…}`）、関数に任せることもある
    // （`pageHref(…)`）。**最初は前者の形しか受け付けない書き方をして、
    // 正しい実装のほうを赤くした。**見たいのは行き先の作り方ではなく、
    // **前が 1 つ戻り、次が 1 つ進み、同じものを数えていること。**
    const line = (attr) => use.split('\n').find((l) => l.includes(`${attr}=`)) ?? ''
    const prev = /(\w+(?:\.\w+)*) - 1/.exec(line('prevHref'))
    const next = /(\w+(?:\.\w+)*) \+ 1/.exec(line('nextHref'))
    assert.ok(prev, `${name}: 「前」の行き先が 1 つ戻る形になっていない`)
    assert.ok(next, `${name}: 「次」の行き先が 1 つ進む形になっていない`)
    assert.equal(prev[1], next[1], `${name}: 前と次で別のものを数えている`)
  }
})

// **CSS はここで見ない。**`server/css-classes.test.mjs` が「画面で使っている
// class に CSS があるか」を全ファイルまとめて見ており、`.pager` を消せば
// そちらが赤くなる（実際に消して確かめた）。ここに同じ検査をもう 1 つ置くと、
// **同じ約束を 2 か所で縛ることになり、片方を直したとき両方を直す羽目になる。**
//
// 最初はここに `css.includes('.pager')` を書いていた。**部分一致なので
// `.pager-x` でも通ってしまい、作り変えを検出できなかった。**気づいたのは、
// 作り変えが緑のまま通ったのを不審に思って調べたときで、そのとき
// 「既に別の試験が見ている」ことも分かった。

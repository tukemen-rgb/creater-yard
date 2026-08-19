/**
 * タグ索引が 0 件のときの出口（設計 U-5）。
 *
 * 2026-08-19 に④が本番を歩いたら、`/tags/` の全文が
 * 「まだタグがありません。」2 行で終わっていた。行き先が 1 つも無い。
 * 一方 `/stories/` の 0 件には誘いがあり、しかもそれは O-4 の設計が
 * 「壊さない」とわざわざ守った対象だった。**同じサービスの中で、
 * 空の面の作り方が揃っていない。**
 *
 * `/tags/` は server と static の 2 ファイルある。**I-8 で「片方だけ直す」が
 * 実際に起きている**ので、この試験は必ず 2 ファイルで回す。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

const TAG_PAGES = ['app/tags/page.server.tsx', 'app/tags/page.static.tsx']
const STORY_PAGES = ['app/stories/page.server.tsx', 'app/stories/page.static.tsx']

const tagSources = Object.fromEntries(
  await Promise.all(TAG_PAGES.map(async (p) => [p, await read(p)])),
)
const storySources = Object.fromEntries(
  await Promise.all(STORY_PAGES.map(async (p) => [p, await read(p)])),
)

test('0 件のときに、次へ行く先がある（2 ファイルとも）', () => {
  for (const [name, src] of Object.entries(tagSources)) {
    assert.match(src, /href="\/write\//, `${name}: 書き始める先へのリンクが無い`)
  }
})

// 面ごとに違う人格を出さない。`/stories/` の 0 件と同じ言い方に揃える。
test('言い方が /stories/ の 0 件と揃っている', () => {
  const phrase = '最初の 1 本を書きませんか。'
  for (const [name, src] of Object.entries(storySources)) {
    assert.ok(src.includes(phrase), `${name}: 揃える先の言い方が変わっている`)
  }
  for (const [name, src] of Object.entries(tagSources)) {
    assert.ok(src.includes(phrase), `${name}: /stories/ と言い方が揃っていない`)
  }
})

// 標準制約「公開カウンタを作らない」。数は分岐にだけ使い、描画しない。
test('タグの数を画面に出さない（分岐に使うだけ）', () => {
  for (const [name, src] of Object.entries(tagSources)) {
    assert.doesNotMatch(src, /\{[^}]*\.length\s*\}/, `${name}: タグの数を描画している`)
  }
})

// 誘い文が節ごとに出ると、1 画面に同じ文が 2 回並ぶ。
test('同じ誘いが 1 画面に 2 回出ない', () => {
  const phrase = '最初の 1 本を書きませんか。'
  for (const [name, src] of Object.entries(tagSources)) {
    const times = src.split(phrase).length - 1
    assert.equal(times, 1, `${name}: 誘いが ${times} 回ある`)
  }
})

/**
 * 誘いは**両軸**を見て出す。片軸だけ見ていると、押せるタグが並んでいる
 * 画面で「まだ何も無い」と誘ってしまう。
 *
 * **ここで縛れるのは「両方を見ているか」までで、「どちら向きの条件か」は
 * 縛れない。**実際、条件を反転する変異（空のときではなく在るときに誘う）を
 * 当てたら、この試験一式は**緑のまま通った**。比較の形（`=== 0` / `< 1` /
 * `!length`）まで型に書くと、同じ意味の書き直しで赤くなるので書かない。
 *
 * **向きはブラウザで確かめる**（両方 0 件 / 片方 0 件 / 両方あり の 3 通り）。
 * CSS を source test で縛れないときと同じ扱い（O-4 の先例）。
 */
test('誘いの条件は両軸を見ている（片軸だけで判断しない）', () => {
  for (const [name, src] of Object.entries(tagSources)) {
    const cond = src.match(/[^\n]*tools[^\n]*topics[^\n]*/g) ?? []
    assert.ok(
      cond.some((line) => line.includes('length')),
      `${name}: 誘いの条件が両軸（tools と topics）を見ていない`,
    )
  }
})

// O-4 の設計が「壊さない」と守った対象。触っていないことをここで縛る。
test('/stories/ の 0 件の誘いを壊していない', () => {
  for (const [name, src] of Object.entries(storySources)) {
    assert.match(src, /まだ Story がありません。/, `${name}: 0 件の文言が消えた`)
    assert.match(src, /href="\/write\//, `${name}: 0 件の誘いの行き先が消えた`)
  }
})

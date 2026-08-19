import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/**
 * I-9「並び順の説明を、説明する対象があるときだけ出す」（設計 2026-08-17 08:30）。
 *
 * `/stories/` の下に、こう出ていた:
 *
 *   新しい記録を基準に、同じ作者が続かないように並べています。閲覧数ランキングではありません。
 *
 * **前半は、書き手が 1 人しか居ないページでは説明する対象が無い。**
 * 「同じ作者が続かないように」と言われても、並んでいるのは全部同じ人である。
 *
 * **後半は消さない。**同じ場所のコメントに **経営判断 2026-08-10 22:00** の
 * 印つきで「**説明は消さない —「閲覧数ランキングではありません」は文化の
 * 説明として要る**」と書いてある。**文化の説明は常に出す。**
 *
 * **この試験の要は「2 ファイルを 1 つの試験で回す」ことである。**
 * server 版と static 版は同じ文言を持っており、**片方だけ直す事故が
 * 実際に起きている**（I-8。ページ送り側だけ直って notice 側が残った）。
 * `page.server.tsx` の冒頭には「両方を直すこと」と注意書きがあるが、
 * **それを守らせる試験は 1 件も無かった。人の注意ではなく仕組みで守る。**
 */
const FILES = [
  ['server 版', '../app/stories/page.server.tsx'],
  ['static 版', '../app/stories/page.static.tsx'],
]
const sources = new Map()
for (const [label, rel] of FILES) {
  sources.set(label, await readFile(new URL(rel, import.meta.url), 'utf8'))
}

test('2 ファイルとも、書き手の数で並べ方の説明を出し分ける', () => {
  for (const [label, source] of sources) {
    assert.match(
      source,
      /authorsOnPage/,
      `${label}: 書き手の数を数えていない。片方だけ直すのが I-8 で起きた事故`,
    )
    assert.match(
      source,
      /authorsOnPage > 1 &&/,
      `${label}: 条件付きになっていない`,
    )
    assert.match(
      source,
      /authorsOnPage > 1 && '新しい記録を基準に/,
      `${label}: 条件が掛かっているのが「並べ方の説明」ではない`,
    )
  }
})

test('2 ファイルとも、文化の説明は条件の外にあって常に出る', () => {
  for (const [label, source] of sources) {
    assert.match(
      source,
      /閲覧数ランキングではありません/,
      `${label}: 文化の説明が消えている（経営判断 2026-08-10 22:00 に反する）`,
    )
    // 条件式と同じ行・同じ波括弧の中に入っていないこと。
    // 入れてしまうと、書き手が 1 人のページで文化の説明ごと消える。
    assert.doesNotMatch(
      source,
      /authorsOnPage > 1 &&[^\n]*閲覧数ランキングではありません/,
      `${label}: 文化の説明が条件の中に入っている。1 人のページで消える`,
    )
  }
})

test('書き手の数は表示中の一覧から数える（新しい API 項目を作らない）', () => {
  for (const [label, source] of sources) {
    assert.match(
      source,
      /new Set\([\s\S]{0,80}stories[\s\S]{0,60}authorHandle[\s\S]{0,20}\)\)\.size/,
      `${label}: listing.stories 由来で数えていない。項目を足すと 2 プロセスにまたがる`,
    )
  }
})

/**
 * **数は分岐にだけ使い、画面には出さない。**
 * 出せばそれは公開カウンタで、標準制約（数字を競争にしない）に触れる。
 */
test('書き手の数を画面に出していない', () => {
  for (const [label, source] of sources) {
    assert.doesNotMatch(
      source,
      /\{\s*authorsOnPage\s*\}/,
      `${label}: 書き手の数を描画している。公開カウンタになる`,
    )
  }
})

/**
 * **触っていないことを縛る。**案 D は 0 件のときの誘いに手を出さない。
 * 1〜4 だけだと、ついでに消しても緑のままになる。
 */
test('2 ファイルとも、0 件のときの誘いはそのまま残っている', () => {
  for (const [label, source] of sources) {
    assert.match(source, /まだ Story がありません。/, `${label}: 0 件の案内が消えている`)
    assert.match(source, /最初の 1 本を書きませんか。/, `${label}: 0 件の誘いが消えている`)
  }
})

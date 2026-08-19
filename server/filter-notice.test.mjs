import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/**
 * I-8「絞り込み中の notice に、効いている条件を全部見せる」（設計 2026-08-14 12:30）。
 *
 * `?tool=godot&topic=影` のとき、画面はこう出ていた:
 *
 *   「godot」で絞り込み中 — 解除する
 *
 * **結果は 2 条件の AND なのに、画面は 1 条件しか名乗らない。**
 * `const filterLabel = tool || topic` が**先に真になったほうだけ**を採るためで、
 * ページ送りの穴（#8 で塞いだ）と**同じ族の「小さな嘘」**である。
 *
 * **試験は 2 ファイルを 1 つで回す。**server 版と static 版は同じ notice を
 * 持っており、**片方だけ直す事故が実際に起きた**のがこの I-8 の元
 * （ページ送り側だけ直って notice 側が残った）。**同じ穴を二度開けない。**
 *
 * 設計の試験計画は 2 件だったが、③は **2 ファイルを回す形**にして 4 件にした。
 * **増やしたのは「どちらのファイルか」の軸で、守る内容は設計のまま**である。
 */
const FILES = [
  ['server 版', '../app/stories/page.server.tsx'],
  ['static 版', '../app/stories/page.static.tsx'],
]
const sources = new Map()
for (const [label, rel] of FILES) {
  sources.set(label, await readFile(new URL(rel, import.meta.url), 'utf8'))
}

test('2 ファイルとも、効いている条件を全部集めている', () => {
  for (const [label, source] of sources) {
    assert.match(
      source,
      /const filterLabels = \[tool, topic\]/,
      `${label}: 条件を全部集めていない`,
    )
    assert.doesNotMatch(
      source,
      /const filterLabel = tool \|\| topic/,
      `${label}: 先に真になったほうだけを採る形が残っている。2 条件目が画面から消える`,
    )
  }
})

test('2 ファイルとも、集めた条件を全部 notice に並べる', () => {
  for (const [label, source] of sources) {
    assert.match(
      source,
      /filterLabels\.map\(/,
      `${label}: 集めただけで並べていない`,
    )
    assert.match(
      source,
      /filterLabels\.length > 0 &&/,
      `${label}: 条件が無いときにも notice を出そうとしている`,
    )
  }
})

/**
 * **空白だけの値を条件として数えない。**`?tool=%20&topic=godot` のとき、
 * 空の「」が 1 つ余計に並ぶと、利用者には**効いていない条件が効いて見える**。
 * 設計の `.filter((v) => v?.trim())` を機械で縛る。
 */
test('2 ファイルとも、空白だけの条件は数えない', () => {
  for (const [label, source] of sources) {
    assert.match(
      source,
      /\.filter\(\([a-z]\) => [a-z]\?\.trim\(\)\)/,
      `${label}: 空白だけの値を条件として数えている`,
    )
  }
})

/**
 * **触っていないことを縛る。**I-8 は「解除する」を全解除のまま残す
 * （条件別の解除 UI は作らない —— 2 条件に UI から到達する入口が
 * まだ無く、MVP では作らないと設計が決めている）。
 */
test('2 ファイルとも、解除は全解除のまま残っている', () => {
  for (const [label, source] of sources) {
    assert.match(source, /解除する/, `${label}: 解除の導線が消えている`)
    assert.match(
      source,
      /href="\/stories\/">解除する/,
      `${label}: 解除の行き先が全解除でなくなっている`,
    )
  }
})

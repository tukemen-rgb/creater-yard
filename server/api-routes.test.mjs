/**
 * `server/api.mjs` の冒頭にある**経路の一覧**が、実装と食い違わないこと。
 *
 * あの一覧は、この API を初めて読む人が最初に見る場所であり、
 * **「何が外に開いているか」の唯一のまとめ**でもある。そこに載っていない
 * 経路は、**開いていることに誰も気づかないまま開いている。**
 *
 * ①が 2026-08-20 に数えたら、**配信の 2 本が載っていなかった** ——
 * `/api/feeds/stories.xml` と `/api/feeds/creators/<handle>.xml`。
 * どちらも**全ページの `<link rel="alternate">` と書き手の面から
 * 実際にリンクされている**、外向きの面である。
 *
 * これは「書き写した約束」の一種で、片方（註釈）が古くなっても
 * **もう片方（実装）は何も言わずに動き続ける。**だから、
 * **一覧を書き写すのではなく、実装から取り出して突き合わせる。**
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./api.mjs', import.meta.url), 'utf8')
const header = source.slice(0, source.indexOf('*/'))

/** 冒頭の一覧に書いてある経路（文字列そのまま）。 */
function documented() {
  return [...header.matchAll(/^\s*\*\s+(?:GET|POST|PUT|DELETE)\s+(\S+)/gm)].map((m) => m[1])
}

/**
 * 実装されている経路。2 通りの書き方を拾う:
 *   `p === '/api/…'`            … そのままの文字列
 *   `/^\/api\/…\/.exec(p)`      … 形で受けるもの。**動く部分の手前まで**を取る
 *   `p.startsWith('/api/…')`    … 前置きで受けるもの
 */
function implemented() {
  const found = new Set()
  for (const m of source.matchAll(/p === '(\/[^']*)'/g)) found.add(m[1])
  for (const m of source.matchAll(/p\.startsWith\('(\/[^']*)'\)/g)) found.add(m[1])
  for (const m of source.matchAll(/\/\^(\\\/[^(]*)\(/g)) {
    found.add(m[1].replace(/\\\//g, '/'))
  }
  return [...found].sort()
}

test('冒頭の一覧が、実装されている経路をすべて挙げている', () => {
  const doc = documented()
  const impl = implemented()
  assert.ok(doc.length > 0, '冒頭に経路の一覧が無い')
  assert.ok(impl.length > 0, '実装から経路を読み取れない')
  const missing = impl.filter((path) => !doc.some((d) => d.startsWith(path)))
  assert.deepEqual(
    missing,
    [],
    `実装されているのに、冒頭の一覧に無い経路:\n  ${missing.join('\n  ')}`,
  )
})

// 逆向きも見る。**消した経路が一覧に残る**と、無いものを在ると言うことになる。
test('冒頭の一覧に、実装されていない経路が残っていない', () => {
  const impl = implemented()
  const stale = documented().filter((d) => !impl.some((path) => d.startsWith(path)))
  assert.deepEqual(stale, [], `一覧に在るのに、実装が見つからない経路:\n  ${stale.join('\n  ')}`)
})

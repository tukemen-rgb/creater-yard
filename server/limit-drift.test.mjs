/**
 * 画面が書き写している上限が、サーバーの上限とずれていないか
 * （①が 2026-08-19 に画像の道を歩いて見つけた）。
 *
 * 書く面には `maxLength={80}` のような数が直接書いてある。**サーバーの
 * `STORY_LIMITS` を書き写したもの**で、いまは全部一致している。
 * **ずれても画面は何も言わない** —— 書き手は打てるのに、送ると断られる
 * （あるいは逆に、打てないのに送れば通る）。
 *
 * A-4 で学んだことを当てる ——
 * **2 つのファイルの間の約束は、片方に書き写すのではなく、
 * もう片方から取り出して比べる。**
 *
 * **数を直接ここに書かない。**書いたら 3 か所目の書き写しになる。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { STORY_LIMITS } from './lib/stories.mjs'
import { IMAGE_LIMITS } from './lib/image.mjs'

const write = readFileSync(new URL('../app/write/page.common.tsx', import.meta.url), 'utf8')
const maxLengths = [...write.matchAll(/maxLength=\{(\d+)\}/g)].map((m) => Number(m[1]))

test('書く面の入力上限は、すべてサーバーの上限のどれかと同じ', () => {
  const allowed = new Set(Object.values(STORY_LIMITS).filter((v) => typeof v === 'number'))
  assert.ok(maxLengths.length >= 4, `上限の指定が ${maxLengths.length} か所しか見つからない`)
  for (const n of maxLengths) {
    assert.ok(allowed.has(n), `画面の maxLength=${n} が STORY_LIMITS のどれとも合わない`)
  }
})

// 個別に突き合わせる。「どれかと同じ」だけだと、題名の欄に本文の上限が
// 入っていても通ってしまう。
test('題名・本文・つまずき・画像の説明が、それぞれ正しい上限を使っている', () => {
  const near = (label, limit) => {
    const at = write.indexOf(label)
    assert.ok(at >= 0, `画面に「${label}」が無い`)
    const found = /maxLength=\{(\d+)\}/.exec(write.slice(at, at + 900))
    assert.ok(found, `「${label}」のそばに上限の指定が無い`)
    assert.equal(Number(found[1]), limit, `「${label}」の上限が ${found[1]}（サーバーは ${limit}）`)
  }
  near('タイトル', STORY_LIMITS.titleMax)
  near('いま悩んでいること', STORY_LIMITS.hurdleMax)
  near('この画像には何が写っていますか', STORY_LIMITS.imageAltMax)
})

test('画面に書いた「n つまで」が、タグの上限と同じ', () => {
  const written = [...write.matchAll(/・(\d+) つまで/g)].map((m) => Number(m[1]))
  assert.ok(written.length >= 2, 'タグの上限の案内が 2 か所に無い')
  for (const n of written) assert.equal(n, STORY_LIMITS.tagsPerAxis, `案内が ${n} つまで（サーバーは ${STORY_LIMITS.tagsPerAxis}）`)
})

test('画面に書いた画像の上限が、サーバーの上限と同じ', () => {
  const written = /(\d+)MB まで/.exec(write)
  assert.ok(written, '画面に画像の上限の案内が無い')
  assert.equal(Number(written[1]), Math.floor(IMAGE_LIMITS.maxBytes / 1024 / 1024))
})

// **0 件しか出せない検査にしない**（O-5 の教訓）。
test('この検査は、ずれを実際に見つけられる', () => {
  const drifted = write.replace(/maxLength=\{80\}/, 'maxLength={81}')
  const allowed = new Set(Object.values(STORY_LIMITS).filter((v) => typeof v === 'number'))
  const found = [...drifted.matchAll(/maxLength=\{(\d+)\}/g)].map((m) => Number(m[1]))
  assert.ok(found.some((n) => !allowed.has(n)), 'ずらしても見つけられていない')
})

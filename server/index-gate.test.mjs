/**
 * 索引を頼む手順は、索引を許す判断より先に実行できない。
 *
 * 2026-08-19 に④が本番を掃いて見つけた形:
 *
 *   - 全ページが `noindex, nofollow`（app/layout.common.tsx。**社長の別判断待ち**）
 *   - なのに robots.txt の註釈は「**本番ドメイン決定後に** Sitemap 行を足す」
 *   - ドメインは 2026-08-14 に決まっている＝**書いてある条件は既に満たされている**
 *   - GO-LIVE にも「Sitemap 行を足す」「Search Console に登録する」が並んでいる
 *
 * **手順どおりに進めた人が、索引しないでくださいと言っているページを
 * 索引してくださいと申請することになる。**条件の書き方が間違っていた。
 *
 * この試験が守るのは順番だけで、**公開するかどうかは社長が決めること**。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

const robots = await read('public/robots.txt')
const goLive = await read('deploy/GO-LIVE.md')
const layout = await read('app/layout.common.tsx')

// 先に足してしまうと、索引しないでくださいと言っているページを
// 索引してくださいと申請することになる。**配るものの側で止める。**
test('配っている robots.txt に Sitemap 行を入れない（索引の判断より先に進めない）', () => {
  const lines = robots.split('\n').filter((l) => !l.trimStart().startsWith('#'))
  assert.ok(
    !lines.some((l) => /^\s*Sitemap:/i.test(l)),
    'robots.txt に Sitemap 行が入っている。索引を許す判断より先には足せない',
  )
})

test('robots.txt の註釈が、条件を「索引を許すとき」と書いている', () => {
  assert.match(robots, /noindex/, '註釈が noindex に触れていない')
  assert.doesNotMatch(
    robots,
    /本番ドメイン決定後/,
    '既に満たされている条件が残っている（ドメインは 2026-08-14 に決まった）',
  )
})

test('GO-LIVE の索引を頼む手順に、noindex の条件が書いてある', () => {
  const item = goLive.indexOf('Sitemap 行を足す')
  assert.ok(item >= 0, 'GO-LIVE から Sitemap の手順が消えた')
  // 手順の周り（前後）に条件が書いてあること。離れた場所の 1 行では、
  // 上から順に読む人の目に入らない
  const around = goLive.slice(Math.max(0, item - 1200), item + 1200)
  assert.match(around, /noindex/, '索引の条件が手順のそばに書かれていない')
  assert.match(around, /Search Console/, '同じ条件がかかる手順が近くに並んでいない')
})

// 条件の側が消えたら、この一式は守るものを失う。実物を見に行く。
test('全ページの noindex は、まだ実物に入っている', () => {
  assert.match(layout, /robots:\s*\{[\s\S]{0,80}index:\s*false/, 'noindex が外れている')
  assert.match(layout, /follow:\s*false/, 'nofollow が外れている')
})

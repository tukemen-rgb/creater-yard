/**
 * 貼られたときのカードを、面ごとにばらつかせない（設計 A-2・2026-08-19 11:30）。
 *
 * サイトは全ページ noindex なので、**人が入ってくる道は貼られたリンクだけ**。
 * ①が経路をコードから数えて 16 本を測ったら、**`og:url` があるのは 4 本**
 * しか無く、**`og:title` にサイト名が入るページが 3 つ**あった
 * （`og:site_name` が別に運んでいるので二重になる）。
 *
 * ここで直すのは、**公開されていて貼られうる面**だけ。ログインの内側と
 * 運営用の面は貼るものではないので触らない。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

/**
 * カードを持つ面。**`'use client'` の面は `metadata` を export できない**ので、
 * 層（`layout.common.tsx`）に置く。層は server 部品なので持てるし、
 * **2 つのモードのどちらでも同じものが配られる**（設計 A-3・2026-08-19 13:00）。
 */
const SHARED = [
  'app/guidelines/page.common.tsx',
  'app/data-policy/page.common.tsx',
  'app/tags/layout.common.tsx',
  'app/report/layout.common.tsx',
]
const sources = Object.fromEntries(await Promise.all(SHARED.map(async (p) => [p, await read(p)])))

test('貼られうる面は、正規 URL を名乗る', () => {
  for (const [name, src] of Object.entries(sources)) {
    assert.match(src, /alternatesFor\(/, `${name}: canonical を出していない`)
    assert.match(src, /ogWithUrl\(/, `${name}: 共有カードの土台を使っていない`)
  }
})

// layout の title.template（'%s | CreatorYard'）が og:title にも当たると、
// og:site_name と二重にブランドが出る。openGraph 側に題名を明示して外す。
// 出典は事例 36（Meta「サイト名などのブランドを付けない記事の題名」）。
test('og:title にサイト名を二重で入れない', () => {
  for (const [name, src] of Object.entries(sources)) {
    const og = src.match(/openGraph: \{[\s\S]*?\}/)
    assert.ok(og, `${name}: openGraph を書いていない`)
    assert.match(og[0], /title/, `${name}: og:title を明示していない（template が当たる）`)
  }
})

test('og:image を足していない（社長の判断待ち）', () => {
  for (const [name, src] of Object.entries(sources)) {
    assert.doesNotMatch(src, /images:/, `${name}: og:image を足している`)
  }
})

// **同じ URL が、どちらのモードで配られるかで違うカードになっていた。**
// いま本番は nginx が /tags/ を必ず server へ回すので実害は出ていないが、
// **それは設定に依存していて、コードでは守られていない。**
// 層に置いてある限り、両モードで同じものが出る。
test('2 モードある面のカードは、層が持つ（片方だけにならない）', async () => {
  for (const dir of ['app/tags']) {
    const layout = await read(`${dir}/layout.common.tsx`)
    assert.match(layout, /export const metadata/, `${dir}: 層がカードを持っていない`)
    for (const variant of ['page.server.tsx', 'page.static.tsx']) {
      const src = await read(`${dir}/${variant}`)
      assert.doesNotMatch(
        src,
        /export const metadata/,
        `${dir}/${variant}: 面の側にもカードがある（層と二重になり、片方だけ古くなる）`,
      )
    }
  }
})

// 'use client' の面は metadata を持てない。持てないものを持たせようとして
// いないこと（持たせても静かに無視されるだけで、気づけない）。
test('client の面に metadata を書かない', async () => {
  for (const page of ['app/report/page.common.tsx', 'app/tags/page.static.tsx']) {
    const src = await read(page)
    assert.match(src, /^'use client'/m, `${page}: client でなくなった（この試験の前提が崩れた）`)
    assert.doesNotMatch(src, /export const metadata/, `${page}: client の面に metadata を書いている`)
  }
})

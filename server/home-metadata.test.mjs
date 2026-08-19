/**
 * トップの共有カード（設計 A・2026-08-19 10:30）。
 *
 * サイトは全ページ noindex なので、**いま人が入ってくる道は「誰かが貼った
 * リンク」だけ**である。①が本番の 4 経路を測ったら、**トップだけ `og:url` が
 * 無かった**（OGP の必須 4 項目の 1 つ・事例 36）。
 *
 * ここはソース検査。**中身が正しいかは、③が焼いた HTML を引いて確かめる**
 * （U-5・U-7 で 2 周続けて「ソース検査は在るかまでしか見ない」を踏んだ）。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const home = await readFile(new URL('../app/page.common.tsx', import.meta.url), 'utf8')

test('トップが canonical と共有カードの土台を出している', () => {
  assert.match(home, /export const metadata/, 'metadata の export が無い')
  assert.match(home, /alternatesFor\(/, 'canonical を出していない')
  assert.match(home, /ogWithUrl\(/, '共有カードの土台を使っていない')
})

// 同じ文字列を 2 か所に持つと必ずずれる。題名と説明は layout から来る。
test('題名と説明をトップで二重に持たない', () => {
  const meta = home.slice(home.indexOf('export const metadata'), home.indexOf('export default'))
  assert.doesNotMatch(meta, /title:/, 'トップが題名を持っている（layout と二重になる）')
  assert.doesNotMatch(meta, /description:/, 'トップが説明を持っている（layout と二重になる）')
})

// 要判断（社長待ち）。ループは足さない。
test('og:image を足していない（社長の判断待ち）', () => {
  assert.doesNotMatch(home, /images:/, 'og:image を足している')
})

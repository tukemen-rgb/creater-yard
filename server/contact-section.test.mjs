import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/data-policy/page.common.tsx', import.meta.url), 'utf8')
const envExample = await readFile(new URL('../deploy/creatoryard.env.example', import.meta.url), 'utf8')

/**
 * I-7「書き手が運営に連絡する道を `/data-policy` に置く」（設計 2026-08-14 10:30）。
 *
 * **値が無くても閉じる設計である。**`CY_CONTACT_EMAIL` が未設定なら
 * **節ごと出さない** —— 「準備中」とも書かない。
 *
 * > **「準備中」は約束になるが、無ければ約束にならない。**
 *
 * これは I-10 で消した「果たせない約束」と同じ考え方で、**先に約束しない**
 * 側から入っている。
 *
 * **この試験が守っていない範囲。**`CY_CONTACT_EMAIL` に実際の値を入れた
 * ときの表示は、ビルドしないと分からない。③はビルドして HTML を実測する
 * こと（ソース検査だけでは「節が出る」ことを確かめられない）。
 */

test('連絡先はビルド時にサーバー側の env から読む', () => {
  assert.match(
    source,
    /process\.env\.CY_CONTACT_EMAIL/,
    '値の出どころが無い',
  )
  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC_/,
    'NEXT_PUBLIC_ は JS バンドルへ焼き込まれる。このページは静的なので接頭辞は要らない',
  )
})

test('値が検査を通らなければ、節ごと出さない（fail-closed）', () => {
  assert.match(
    source,
    /contactEmail\(\)/,
    '検査を通す関数が無い',
  )
  assert.match(
    source,
    /\{contact && \(/,
    '節を条件で囲っていない。未設定のときに空の節が出る',
  )
  assert.doesNotMatch(
    source,
    /準備中/,
    '「準備中」は約束になる。無ければ約束にならない（I-10 と同じ考え方）',
  )
})

/**
 * **2 段で検査する。**設計が正直に書いているとおり、
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` は**空白を弾くだけ**で、`<` や `"` は通る。
 * だから記号の拒否を別に置く。**1 段で足りると書いたら嘘になる。**
 */
test('HTML と mailto への差し込みを 2 段で止める', () => {
  assert.match(source, /\[\^\\s@\]\+@\[\^\\s@\]\+/, 'メール形式の検査が無い')
  // 記号の拒否。実装は 1 つの文字クラスにまとめてよいので、**先頭 4 文字**
  // だけを見る（`[<>"'?&]` でも `[<>"']` でも通る）。型を実装の書き方に
  // 縛りすぎると、同じ意味の直しで赤くなる。
  assert.match(source, /\[<>"'/, '記号の拒否が無い。形式検査だけでは < や " が通る')
  assert.match(source, /\?&\]/, 'mailto のヘッダ差し込み（?cc= など）を拒否していない')
})

test('応答の期限を約束しない', () => {
  assert.doesNotMatch(source, /以内に|営業日|時間以内|SLA/, '応答期限は運営体制の約束になる')
  assert.match(source, /人が最終確認/, '誰が見るのかが書かれていない')
  assert.doesNotMatch(
    source,
    /AI が一次受付|AI が最初/,
    '運用体制は書き手に約束する応答品質ではない（設計の判断）',
  )
})

test('既存の節を 1 つも消していない', () => {
  for (const heading of ['持っているもの', '消すとき', '画像について']) {
    assert.match(source, new RegExp(heading), `既存の節「${heading}」が消えている`)
  }
})

test('配備の手順書に CY_CONTACT_EMAIL が載っている', () => {
  assert.match(
    envExample,
    /CY_CONTACT_EMAIL/,
    'env の見本に無いと、設定できることに人が気づけない',
  )
})

/**
 * **反映のあとに確かめる先は、1 か所で決める。**
 *
 * `deploy/apply-latest.sh` は反映のあと、公開されている入口を 3 回叩く
 * （CSP・トップの本文・素材の照合）。以前はその URL を**毎回書き写して**いた。
 *
 * **直書きだと、入口を変えた日に「配ったのとは別のサイト」を確かめてしまう。**
 * しかも配置と再起動は先に終わっているので、**取り返しがつかない順序**で
 * 気づくことになる。社長の未決に「`www.` を用意するか」が入っている以上、
 * これは仮の話ではない。
 *
 * ここで縛るのは 3 つ:
 *
 *   1. 公開を叩く行が、**すべて同じ 1 つの値**を使っていること
 *   2. その値が、**ビルドが canonical に使うのと同じ設定**から来ていること
 *   3. 既定値が、`deploy/verify-public-assets.sh` の既定と**同じ**であること
 *      —— **数を書き写さない。**両方のファイルから取り出して比べる
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const apply = read('deploy/apply-latest.sh')
const verify = read('deploy/verify-public-assets.sh')

/** `NAME="${SOMETHING:-<既定>}"` の既定を取り出す。 */
function fallbackOf(source, name) {
  const m = new RegExp(String.raw`^${name}="\$\{[A-Z_]+:-([^}"]+)\}"`, 'm').exec(source)
  assert.ok(m, `${name} の既定が読み取れない`)
  return m[1]
}

/** 手順書の中で、公開の入口を叩いている行。 */
function publicCalls() {
  return apply
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .filter((line) => /curl[^\n]*https?:\/\/|curl[^\n]*PUBLIC_ORIGIN/.test(line))
}

test('公開を叩く行が、URL を書き写していない', () => {
  for (const line of publicCalls()) {
    assert.doesNotMatch(
      line,
      /https?:\/\/[a-z]/,
      `公開の入口を書き写している行がある: ${line.trim()}`,
    )
  }
})

test('公開を叩く行は、すべて同じ 1 つの値を使う', () => {
  const calls = publicCalls()
  assert.ok(calls.length >= 2, '公開を叩く行が見つからない（試験の前提が崩れている）')
  for (const line of calls) {
    assert.match(line, /\$PUBLIC_ORIGIN/, `別の決め方をしている行がある: ${line.trim()}`)
  }
})

test('その値は、ビルドが canonical に使う設定から来ている', () => {
  assert.match(
    apply,
    /^PUBLIC_ORIGIN="\$\{CY_SITE_ORIGIN:-/m,
    '公開の入口が、ビルドの設定と別の出どころになっている',
  )
})

test('既定の入口が、素材の照合と食い違わない', () => {
  assert.equal(
    fallbackOf(apply, 'PUBLIC_ORIGIN'),
    fallbackOf(verify, 'ORIGIN'),
    '2 つの手順書が、既定で別のサイトを見に行く',
  )
})

test('素材の照合にも、同じ入口を渡している', () => {
  assert.match(
    apply,
    /ORIGIN="\$PUBLIC_ORIGIN"\s+sh\s+\S*verify-public-assets\.sh/,
    '素材の照合だけが自分の既定で動く（入口を変えても付いてこない）',
  )
})

test('末尾のスラッシュを落としている', () => {
  // 設定ファイルに `https://…/` と書かれていても `//` を叩かないこと。
  assert.match(apply, /^PUBLIC_ORIGIN="\$\{PUBLIC_ORIGIN%\/\}"/m, '末尾の / を落としていない')
})

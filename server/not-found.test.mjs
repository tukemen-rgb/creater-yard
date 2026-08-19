/**
 * 見つからなかったときの面（設計 U-9）。
 *
 * **いちばん静かな壊れ方は「名前を間違えて、黙って既定に戻る」。**
 * `next.config.mjs` の `pageExtensions` は 2 モードで別の配列を採る。
 * `not-found.tsx` と名付けると**どちらのモードでも拾われず**、画面は
 * 何も言わずに Next 既定の英語の 404 に戻る —— ビルドも lint も通る。
 *
 * だから**その配列を設定から取り出して**、置いてある名前と突き合わせる
 * （PR #50・#51 と同じ形。拡張子を試験に書き写さない）。
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

/**
 * `pageExtensions` の 2 本の配列を、設定のソースから取り出す。
 * 値は書かない —— 設定が変わったらここも一緒に動く。
 */
function pageExtensionSets() {
  const src = read('next.config.mjs')
  const block = src.match(/pageExtensions:[\s\S]*?\n\s*\?\s*(\[[^\]]*\])[\s\S]*?:\s*(\[[^\]]*\])/)
  assert.ok(block, 'next.config.mjs から pageExtensions を読み取れない')
  const parse = (text) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1])
  const sets = [parse(block[1]), parse(block[2])]
  for (const s of sets) assert.ok(s.length > 0, 'pageExtensions が空に読めた')
  return sets
}

const notFoundFiles = () => globSync('app/**/not-found*.tsx', { cwd: ROOT })

test('見つからなかったときの面が、置いてある', () => {
  assert.notDeepEqual(notFoundFiles(), [], 'not-found の面が無い（既定の英語に戻る）')
})

test('その名前が、2 モードとも拾われる形になっている', () => {
  const sets = pageExtensionSets()
  for (const f of notFoundFiles()) {
    for (const exts of sets) {
      assert.ok(
        exts.some((ext) => f.endsWith(`not-found.${ext}`)),
        `${f}: この名前は pageExtensions [${exts.join(', ')}] に拾われない`,
      )
    }
  }
})

/**
 * 出口が実在するか。**行き止まりの面から、行き止まりのリンクを出さない。**
 * 行き先は `app/` の実物と突き合わせる（URL を試験に書き写さない）。
 */
function routeExists(href) {
  const dir = `app${href.replace(/\/$/, '')}`
  if (href === '/') return globSync('app/page.*.tsx', { cwd: ROOT }).length > 0
  return globSync(`${dir}/page.*.tsx`, { cwd: ROOT }).length > 0
}

test('出口のリンクが、実在する面を指している', () => {
  const files = notFoundFiles()
  const hrefs = files.flatMap((f) =>
    [...read(f).matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]),
  )
  assert.ok(hrefs.length > 0, '出口のリンクが 1 本も無い（行き止まりのまま）')
  const dead = hrefs.filter((h) => !h.startsWith('/api/') && !routeExists(h))
  assert.deepEqual(dead, [], `行き先の無いリンク: ${dead.join(' ')}`)
})

// 消えていることは、この場所では異常ではない（書き手はいつでも消せる）。
// **その説明が面に書いてあること。**「404」とだけ出して黙るのと違う。
test('なぜ見つからないのかを、読み手の言葉で書いている', () => {
  const src = notFoundFiles().map((f) => read(f)).join('\n')
  const inCode = src
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n')
  assert.match(inCode, /消した|公開をやめ/, '消えている場合の説明が無い')
})

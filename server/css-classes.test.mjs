/**
 * 画面で使っている class に、CSS があるか（①が 2026-08-19 に数えた）。
 *
 * **class 名は「書き写した約束」である。**片方（CSS）が消えても、
 * もう片方（画面）は何も言わずに素通りする。**壊れないので気づけない。**
 *
 * 実際、①が数えたら **`story__next` と `story__sources` に CSS が無かった。**
 * `story__next` は I-11 で足したもので、**PR に「ブラウザで見た」と書いたのに、
 * スタイルが当たっているかは見ていなかった。**
 *
 * **これは「壊れている」ではなく「溜まる」種類の問題である。**放っておくと、
 * 次に触る人が「この class は何をしているのか」を毎回調べることになる。
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

/**
 * **意図して CSS を持たない class。**
 * 理由を書いていないものはここに入れない —— 入れた瞬間に、この検査は
 * 「例外の一覧」になって読まれなくなる。
 */
const HOOKS_WITHOUT_STYLE = new Map([
  ['interview', 'ヒアリングの section を指す名前。中身（interview__*）だけを飾る'],
  ['story', '記事の article を指す名前（className="page story"）。飾りは page と story__* が持つ'],
])

/** `className={`a b--${x}`}` のような組み立ては、確定している部分だけを見る。 */
function classesUsed() {
  const used = new Map()
  const files = [
    ...globSync('app/**/*.tsx', { cwd: ROOT }),
    ...globSync('components/*.tsx', { cwd: ROOT }),
  ].filter((f) => !f.includes('.test.'))
  for (const f of files) {
    const src = read(f)
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const raw = m[1] ?? m[2]
      // 埋め込みを含む語は、埋め込みの手前で切れているので数えない
      for (const token of raw.split(/\s+/)) {
        if (!token || token.includes('${')) continue
        if (!/^[a-zA-Z][\w-]*$/.test(token)) continue
        used.set(token, (used.get(token) ?? new Set()).add(f))
      }
    }
  }
  return used
}

const defined = new Set([...read('app/globals.css').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))

test('画面で使っている class には、CSS がある', () => {
  const orphans = []
  for (const [name, files] of classesUsed()) {
    if (defined.has(name) || HOOKS_WITHOUT_STYLE.has(name)) continue
    orphans.push(`${name}  ← ${[...files].join(', ')}`)
  }
  assert.deepEqual(orphans, [], `CSS の無い class:\n  ${orphans.join('\n  ')}`)
})

// 例外は「理由つき」でだけ置ける。理由の無い例外は、次に読む人に
// 「なぜ許されているのか」を調べさせる。
test('CSS を持たない class には、理由が書いてある', () => {
  for (const [name, reason] of HOOKS_WITHOUT_STYLE) {
    assert.ok(reason && reason.length > 10, `${name}: 理由が書かれていない`)
  }
})

// **0 件しか出せない検査にしない**（O-5 の教訓）。
test('この検査は、CSS の無い class を実際に見つけられる', () => {
  // **消した 1 つが「必ず含まれる」ことを見る。**「それだけが出る」と書くと、
  // 本物の孤児が 1 つでもあると外れて、検査の意味とずれる。
  const fake = new Set(defined)
  fake.delete('story-card__excerpt')
  const found = [...classesUsed().keys()].filter((n) => !fake.has(n) && !HOOKS_WITHOUT_STYLE.has(n))
  assert.ok(found.includes('story-card__excerpt'), '消した 1 つを見つけられていない')
})

#!/usr/bin/env node
/**
 * 試験が「別のファイルにある約束」を書き写していないかを洗う。
 *
 * 2026-08-19 の A-4 で実際に起きた形:
 *
 *   実装  書く面へのリンクを、間違った鍵の名前で組み立てていた
 *   試験  同じ間違った鍵の名前を、そのまま書き写していた
 *
 * **この註釈に、その間違った鍵そのものを書かないこと。**書くとこの網の
 * 「製品側に在るか」に自分で当たってしまい、**自分の網を無効にする**
 * （この repo で何度も踏んでいる、註釈が試験に拾われる罠）。
 *
 * **試験が実装と同じ思い込みから書かれると、何も守らない。**型がどれだけ
 * 細かくても一致してしまう。あのとき捕まえたのはブラウザだけだった。
 *
 * ここが洗うのは「試験の中のリテラルが、製品側のどこにも無い」場合だけ。
 * **一致していれば正しい、とまでは言えない**（両方まとめて間違っている
 * ことはありうる）。**これは網であって、証明ではない。**
 *
 * 使い方:
 *   node scripts/audit-copied-literals.mjs          … 洗って一覧を出す
 *   node scripts/audit-copied-literals.mjs --quiet  … 食い違いが無ければ黙る
 *
 * 終了コード: 0 = 食い違い無し / 2 = 食い違いあり（**配備の失敗ではない**）
 */
import { globSync, readFileSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname

/**
 * 製品側として見る場所。**`scripts/` を入れるのを忘れない** ——
 * 最初これを落として `CY_TEST_GLOB` を「実装に無い」と誤って報せた。
 */
const IMPL_GLOBS = [
  'app/**/*.tsx',
  'components/**/*.tsx',
  'lib/**/*.ts',
  'server/**/*.mjs',
  'scripts/**/*.mjs',
  'deploy/*.sh',
  'public/*.txt',
]

/**
 * 洗う対象。**製品の約束になっているものだけ**を見る。
 * 語や文言は入れない（同じ語が偶然どこかに在るだけで通ってしまう）。
 */
const KINDS = [
  { label: 'クエリの鍵', re: /\?([a-zA-Z_][\w-]*)=/g, find: (v, impl) => impl.includes(`get('${v}')`) || impl.includes(`?${v}=`) },
  { label: '端末の保存キー', re: /'(creatoryard:[\w-]+)'/g, find: (v, impl) => impl.includes(v) },
  { label: 'API の経路', re: /'(\/api\/[\w./-]+)'/g, find: (v, impl) => impl.includes(v) || impl.includes(prefixOf(v)) },
  { label: '環境変数', re: /\b(CY_[A-Z_]+|HEALTH_[A-Z_]+|BACKUP_[A-Z_]+|REPORT_[A-Z_]+|VERSION_[A-Z_]+|DEPLOY_DIR)\b/g, find: (v, impl) => impl.includes(v) },
]

/**
 * 埋め込みで組み立てる経路（`` `/api/feeds/creators/${handle}.xml` ``）は、
 * 試験の側では実際の値（`/api/feeds/creators/hana.xml`）で書かれる。
 * **最後の `/` までの前置きで照合する。**
 */
function prefixOf(path) {
  const at = path.lastIndexOf('/')
  return at <= 0 ? path : path.slice(0, at + 1)
}

/**
 * **註釈は約束ではない。**試験の註釈には「昔ここを間違えた」と書くことが
 * あり、そこに出てくる名前まで拾うと**誤って鳴る**（実際に鳴らせた）。
 * 誤って鳴る警報は、鳴らない警報より信用を減らす。
 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

/**
 * `import('../lib/x.ts?foo=…')` の `?foo=` は**画面のクエリではない**。
 * 置き場を変えて読み直させるための、その試験の中だけの目印
 * （tag-display-names・pager-drift が使っている手）。
 *
 * ここは名前の一覧では持たない（`ssr` 1 つの一覧を置いていたのをやめた）。
 * **「読み込みの行先に書いてある」という形で見分ける。**一覧にすると、
 * 次に同じ手を使う人が理由の分からない誤報を踏み、一覧に名前を足して
 * 黙らせることになる —— 網が名前ひとつぶん粗くなり、それが増えていく。
 */
function withoutImportSpecifiers(source) {
  return source.replace(/\bimport\(\s*(['"`])[^'"`]*\1\s*\)/g, 'import(SPEC)')
}

const quiet = process.argv.includes('--quiet')
const impl = IMPL_GLOBS.flatMap((g) => globSync(g, { cwd: ROOT }))
  .filter((f) => !f.includes('.test.'))
  .map((f) => readFileSync(new URL(f, import.meta.url.replace(/scripts\/[^/]+$/, '')), 'utf8'))
  .join('\n')

const tests = globSync('server/*.test.mjs', { cwd: ROOT }).sort()
const missing = []
let checked = 0
const seen = new Set()

for (const tf of tests) {
  const src = withoutImportSpecifiers(
    withoutComments(readFileSync(new URL(`../${tf}`, import.meta.url), 'utf8')),
  )
  for (const kind of KINDS) {
    for (const m of src.matchAll(kind.re)) {
      const value = m[1]
      const key = `${tf}|${kind.label}|${value}`
      if (seen.has(key)) continue
      seen.add(key)
      checked += 1
      if (!kind.find(value, impl)) {
        missing.push({ tf, line: src.slice(0, m.index).split('\n').length, kind: kind.label, value })
      }
    }
  }
}

if (!quiet || missing.length > 0) {
  console.log(`試験が書き写している約束 ${checked} 件を、製品側と突き合わせました。`)
}
for (const x of missing) {
  console.log(`  NG: ${x.tf}:${x.line}  ${x.kind}「${x.value}」が製品側に見つかりません`)
}
if (missing.length === 0) {
  if (!quiet) console.log('  食い違い: 0 件')
} else {
  console.log(`  食い違い: ${missing.length} 件。**試験と実装が同じ思い込みで書かれていないか確かめること**`)
}

// **この網が見ていないもの**（数を報せるときは一緒に言う）:
//   - 文言・見出し（同じ語が偶然どこかに在るだけで通る）
//   - 両方まとめて間違っている場合（一致していても正しいとは限らない）
//   - 製品側が動的に組み立てる名前（`get(key)` のように変数で読む形）
//   - **試験の註釈**（約束ではないので、はじめから外している）
//   - **読み込みの行先に付けた目印**（`import('…?dir=…')`。同上）
process.exit(missing.length === 0 ? 0 : 2)

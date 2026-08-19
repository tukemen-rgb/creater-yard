/**
 * 画面に出る日本語と Latin 語のあいだに、空白を入れる（この場所の書き方）。
 *
 * 2026-08-19 に①が数えたら **54 対 16** で、大多数は空白を入れていた。
 * 入っていない 16 か所は**保存まわりとヒアリング**に固まっていて、
 * 別の時に別の手で書かれたことが見て取れた。
 *
 * **これは好みではなく「揃っていない」という事実である**（U-5・U-6 と同じ形）。
 * とりわけヘッダーの「保存した Story」は**全ページに出る**。
 *
 * 句読点や中黒の隣は数えない —— **空白が無くて当然**なので、混ぜると
 * 数が嘘になる（①は 1 度これで 35 件と誤って数えた）。
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const KANA = '[ぁ-んァ-ヶ一-龠]'
const LATIN = '(?:Story|CreatorYard|GAMEYARD|RSS)'

/**
 * 断り文句のクラスを**コードから拾う。**
 *
 * **最初はここに `StoryError|AuthError|ReportError` と書き写していた。**
 * 実際には `ImageError` `MailError` `RateLimitError` もあり、
 * **分母が 53 件のところを 89 件のうち 53 件しか見ていなかった**
 * （2026-08-19 に①が気づいた。**幸い、見ていなかった側に違反は無かった**）。
 *
 * A-4 で学んだことを、自分の試験に当てる ——
 * **2 つのファイルの間の約束は、片方に書き写すのではなく、
 * もう片方から取り出して比べる。**
 */
function errorClasses() {
  const names = new Set()
  for (const f of globSync('server/lib/*.mjs', { cwd: ROOT })) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    for (const m of src.matchAll(/export class (\w*Error)\b/g)) names.add(m[1])
  }
  return [...names].sort()
}

const errorMessagePattern = () =>
  new RegExp(String.raw`new (?:${errorClasses().join('|')})\(\s*(?:'([^']*)'|\`([^\`]*)\`)`, 'g')

/** 註釈は画面に出ない。ここで数えると、説明のために書いた語まで拾う。 */
const isComment = (line) => /^\s*(\*|\/\/|\/\*)/.test(line)

function offenders() {
  const files = [
    ...globSync('app/**/*.tsx', { cwd: ROOT }),
    ...globSync('components/*.tsx', { cwd: ROOT }),
  ].filter((f) => !f.includes('.test.'))
  const found = []
  for (const f of files) {
    const lines = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (isComment(line)) return
      const re = new RegExp(`${KANA}${LATIN}|${LATIN}${KANA}`, 'g')
      for (const m of line.matchAll(re)) found.push(`${f}:${i + 1} 「${m[0]}」`)
    })
  }
  return found
}

/**
 * 数字も同じ（2026-08-19 に①が測った）。**画面は 42 対 10 で空けていて、
 * 詰まっていたのはほとんど断り文句だった。**書き手は同じ流れで両方を見る ——
 * フォームの「パスワード（10 文字以上）」を読んで打ち、断られると
 * 「パスワードは10文字以上に…」が返ってきていた。**同じ画面に 2 通りの
 * 書き方が並ぶ。**
 *
 * `${label}` のように**語**が入る埋め込みは数えない（「ツールタグはリストで」
 * は詰めて正しい）。数字か、大文字で始まる上限の名前だけを見る。
 */
function numberOffenders() {
  const NUM = String.raw`(?:\d|\$\{[A-Z_][\w.]*\})`
  const found = []
  const scan = (name, text, lineNo) => {
    for (const m of text.matchAll(new RegExp(`${KANA}${NUM}|${NUM}${KANA}`, 'g'))) {
      found.push(`${name}${lineNo ? `:${lineNo}` : ''} 「${m[0]}」`)
    }
  }
  const files = [
    ...globSync('app/**/*.tsx', { cwd: ROOT }),
    ...globSync('components/*.tsx', { cwd: ROOT }),
  ].filter((f) => !f.includes('.test.'))
  for (const f of files) {
    readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split('\n').forEach((line, i) => {
      if (!isComment(line)) scan(f, line, i + 1)
    })
  }
  // 断り文句は**書き手に返る文字列**なので、画面と同じ扱いにする。
  for (const f of [...globSync('server/lib/*.mjs', { cwd: ROOT }), ...globSync('server/*.mjs', { cwd: ROOT })]) {
    if (f.includes('.test.')) continue
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    for (const m of src.matchAll(errorMessagePattern())) scan(f, m[1] ?? m[2], 0)
  }
  return found
}

test('数字と日本語のあいだにも空白を入れる（画面と断り文句の両方）', () => {
  const bad = numberOffenders()
  assert.deepEqual(bad, [], `空白が入っていない箇所:\n  ${bad.join('\n  ')}`)
})

test('日本語と Latin 語のあいだに空白を入れる（画面に出る文字列）', () => {
  const bad = offenders()
  assert.deepEqual(bad, [], `空白が入っていない箇所:\n  ${bad.join('\n  ')}`)
})

// **数えられていることを確かめる。**0 件しか出せない検査は、0 件しか
// 出せない壊れ方をする（O-5 の教訓）。
test('この検査は、揃っていない箇所を実際に数えられる', () => {
  const re = () => new RegExp(`${KANA}${LATIN}|${LATIN}${KANA}`, 'g')
  // 両側を仮名に挟まれていても **1 件**として数える（前半で語を使い切るため）。
  // 見つけ漏らしはしないので、赤／緑の判定には足りる。**件数は上限ではない。**
  assert.equal([...('ここに' + 'Story' + 'がある').matchAll(re())].length, 1, '仮名に挟まれた語を拾えていない')
  assert.equal([...('保存した' + 'Story').matchAll(re())].length, 1, '前に付く形を拾えていない')
  assert.equal([...('Story' + 'を読む').matchAll(re())].length, 1, '後ろに付く形を拾えていない')
  // 句読点の隣は数えない（空白が無くて当然）。
  assert.equal([...'、Story。'.matchAll(re())].length, 0, '句読点の隣まで数えている')
  // 正しく空白が入っているものは数えない。
  assert.equal([...'保存した Story を読む'.matchAll(re())].length, 0, '揃っているものまで数えている')
})

// **分母が黙って狭まらないようにする。**クラスを書き写していたときは、
// 3 つしか見ていないことに誰も気づけなかった。
test('断り文句のクラスを、コードから漏れなく拾えている', () => {
  const found = errorClasses()
  assert.ok(found.length >= 6, `拾えたクラスが ${found.length} 個しかない: ${found.join(', ')}`)
  for (const name of ['StoryError', 'AuthError', 'ImageError']) {
    assert.ok(found.includes(name), `${name} を拾えていない`)
  }
  // **魔法の数字を置かない。**「80 件以上」と書いたら、それが何の 80 なのか
  // 誰も説明できない（最初そう書いて、実際の 78 件で外した）。
  // 比べるのは**書き写していたときの見え方**そのものにする。
  const count = (pattern) => {
    let n = 0
    for (const f of globSync('server/lib/*.mjs', { cwd: ROOT })) {
      const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
      n += [...src.matchAll(pattern)].length
    }
    return n
  }
  const all = count(errorMessagePattern())
  const copiedByHand = count(/new (?:StoryError|AuthError|ReportError)\(\s*(?:'([^']*)'|`([^`]*)`)/g)
  assert.ok(all > copiedByHand, `書き写していたときと同じ ${all} 件しか見えていない`)
})

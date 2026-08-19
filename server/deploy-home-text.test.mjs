/**
 * **反映の最後の確認が探す語が、本当にトップに在ること。**
 *
 * `deploy/apply-latest.sh` は、配置と再起動が終わったあとに公開ホームを
 * 取ってきて、**トップの文言が入っているか**を見る。ここで食い違うと
 * 手順書は `exit 1` する —— **もう配り終わったあと**である。
 *
 * つまり、**トップの文言を変えた人が手順書を直し忘れると、
 * 反映は成功しているのに「失敗しました」と出る。**夜中にこれを読む人は、
 * 本番が壊れたのか、探す語が古いのかを見分けられない。
 *
 * **語を書き写さない。**手順書から取り出して、製品側に在るかを見る。
 * （`scripts/audit-copied-literals.mjs` の網は**試験が実装を写した場合**を
 * 洗うもので、**手順書が画面の文言を写した場合**は見ていない。
 * また、あの網は「語や文言は入れない」と決めている —— 同じ語が偶然
 * どこかに在るだけで通ってしまうため。ここは 1 語だけを名指しで見る。）
 */
import assert from 'node:assert/strict'
import { readFileSync, globSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(new URL(p, new URL(ROOT, 'file:')), 'utf8')
const apply = readFileSync(new URL('../deploy/apply-latest.sh', import.meta.url), 'utf8')

/** 手順書が探しているトップの語（`HOME_MARK='…'`）。 */
function homeMark() {
  const m = /^HOME_MARK='([^']+)'/m.exec(apply)
  assert.ok(m, '反映の手順書がトップの語を名前つきで持っていない')
  return m[1]
}

test('反映が探すトップの語は、本当にトップの面に在る', () => {
  const mark = homeMark()
  const pages = globSync('app/**/*.tsx', { cwd: ROOT })
  const holders = pages.filter((p) => read(p).includes(mark))
  assert.ok(
    holders.length > 0,
    `反映が探す語「${mark}」が、画面のどこにも無い（反映は成功しても「失敗しました」と出る）`,
  )
})

test('食い違ったときに、次に何をすればよいかを言う', () => {
  const at = apply.indexOf('HOME_MARK')
  const tail = apply.slice(at)
  assert.match(tail, /配置と再起動は終わっています/, '配り終わったあとだと言っていない')
  assert.match(tail, /HOME_MARK も直して/, '手順書の側を直せと言っていない')
})

/**
 * 「反映すると何が変わるか」を作る道具（設計 D-1）。
 *
 * **本番へ問い合わせない。**起点は必ず引数で渡す（道具は、渡されなかった
 * ときだけ本番の `last-modified` を見に行く）。試験が外へ出ないため。
 *
 * **この試験を書いていて、④の報告の誤りが 1 つ出た。**
 * ④は毎周「本番は `main` の n 本うしろ」を
 * `git rev-list --count --merges` で数えていた。**この数え方は、枝の中に
 * 取り込まれたマージ（`Merge main into <枝>`）まで数える。**
 *
 *   rev-list      … 47 本
 *   --first-parent … **44 本**（main が実際に進んだ段数）
 *
 * 差の 3 本は `main` の一段目に無い。**うしろの本数は 3 本多く報告されていた。**
 * ここでは `--first-parent` で数え、**その一致を試験で固定する。**
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

import { classify, collect, parsePr } from '../scripts/deploy-digest.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const SINCE = 'Sun, 16 Aug 2026 15:11:51 GMT'
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })

test('束ね方は、触ったファイルだけで決まる', () => {
  assert.equal(classify(['app/page.common.tsx']), '画面で気づくもの')
  assert.equal(classify(['components/pager.tsx']), '画面で気づくもの')
  assert.equal(classify(['server/api.mjs']), '配られるもの')
  assert.equal(classify(['server/lib/feed.mjs']), '配られるもの')
  assert.equal(classify(['public/robots.txt']), '配られるもの')
  assert.equal(classify(['server/x.test.mjs']), '内側だけ')
  assert.equal(classify(['docs/HANDOVER.md']), '内側だけ')
  // 画面の試験は「画面で気づくもの」ではない（画面は変わらない）
  assert.equal(classify(['server/story-ui.test.mjs']), '内側だけ')
})

test('同じ入力なら、同じ束に入る（その場で決めない）', () => {
  const files = ['app/page.common.tsx', 'server/api.mjs', 'docs/x.md']
  assert.equal(classify(files), classify([...files].reverse()))
})

/**
 * **数え落としをしない。**内訳の合計が、`main` の一段目のマージ数と一致する。
 * ここが合っていないと、社長が読むまとめが**全体より少ない**ことになる。
 */
test('内訳の合計が、main が進んだ段数と一致する', () => {
  const { groups, branchMerges, total } = collect(SINCE)
  const firstParent = git(['log', '--first-parent', '--merges', `--since=${SINCE}`, '--format=%H', 'origin/main'])
    .trim()
    .split('\n')
    .filter(Boolean).length
  const counted = [...groups.values()].reduce((n, rows) => n + rows.length, 0) + branchMerges.length
  assert.equal(total, firstParent, 'main の一段目の数と、拾った数が違う')
  assert.equal(counted, total, '内訳の合計が、全体と合っていない')
})

/**
 * **`rev-list` で数えると多くなる。**その差が「枝の中に取り込まれたマージ」
 * であることを、試験の側でも押さえておく（④が同じ数え方へ戻らないため）。
 */
test('rev-list の数え方は、main の一段目より多くなりうる', () => {
  const revList = Number(git(['rev-list', '--count', '--merges', `--since=${SINCE}`, 'origin/main']).trim())
  const { total } = collect(SINCE)
  assert.ok(
    revList >= total,
    `rev-list（${revList}）が一段目（${total}）より少ない。数え方の前提が変わった`,
  )
})

/**
 * **押し方は 1 通りではない。**この repo の履歴に実際に在る 3 通りを、
 * すべて PR として拾えること（**題は履歴から取る。作らない**）。
 *
 * 最初は `Merge PR #n:` しか受けず、**GitHub の画面から押したものを
 * 「枝の取り込み」に落としていた** —— 社長が押したものが、まとめから
 * 消える形だった。
 */
test('PR の題の書き方 3 通りを、すべて拾う', () => {
  const subjects = git(['log', '--first-parent', '--merges', '--format=%s', 'origin/main'])
    .split('\n')
    .filter(Boolean)
  const shapes = {
    'Merge PR #': subjects.find((s) => /^Merge PR #\d+: /.test(s)),
    'Merge pull request #': subjects.find((s) => /^Merge pull request #\d+ from /.test(s)),
    '(#n) の形': subjects.find((s) => /\(#\d+\)$/.test(s)),
  }
  for (const [name, subject] of Object.entries(shapes)) {
    assert.ok(subject, `履歴に「${name}」の例が無い（試験の前提が変わった）`)
    const pr = parsePr(subject)
    assert.ok(pr, `${name} を PR として拾えていない: ${subject}`)
    assert.match(pr.number, /^\d+$/, `${name} の番号が取れていない`)
    assert.ok(pr.title.length > 0, `${name} の題が空`)
  }
})

test('PR でないマージは、PR として拾わない', () => {
  assert.equal(parsePr('Merge main into ops/report-health'), null)
  assert.equal(parsePr('Merge branch main of github.com:x/y'), null)
})

test('PR 番号を持たないマージは、別に数える', () => {
  const { groups, branchMerges } = collect(SINCE)
  for (const rows of groups.values()) {
    for (const row of rows) {
      assert.match(row.number, /^\d+$/, 'PR 番号でないものが束に入っている')
    }
  }
  assert.ok(Array.isArray(branchMerges), '枝の取り込みを数えていない')
})

// 出す文字に、作者名や鍵を混ぜない（個人単位の記録を作らない方針）。
test('出すのは commit の題だけ（作者名を出さない）', () => {
  const { groups } = collect(SINCE)
  const titles = [...groups.values()].flat().map((row) => row.title)
  assert.ok(titles.length > 0, 'まとめる対象が 1 つも無い')
  const authors = new Set(
    git(['log', '--first-parent', '--merges', `--since=${SINCE}`, '--format=%an', 'origin/main'])
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  for (const name of authors) {
    assert.ok(!titles.some((t) => t.includes(name)), `出す文字に作者名が入っている: ${name}`)
  }
})

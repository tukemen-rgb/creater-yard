/**
 * 「編集する」（`components/edit-link.tsx`）。
 *
 * ③が 2026-08-19 に数えた「どの試験も見ていない画面 10 本」の 2 本目。
 * **ここは A-4 で一度壊した場所でもある** —— 書く面へのリンクを
 * `?edit=` という**存在しない鍵**で組み立て、試験にも同じ鍵を書いたので
 * 緑のまま通った。捕まえたのはブラウザだけだった。
 *
 * だから鍵は**書く面が実際に読んでいるもの**から取る。そして
 * **`/write/` へ送っている面を探して、見つかった全部**を突き合わせる ——
 * `draft-continue.test.mjs` は `/account/` の 1 か所だけを見ていて、
 * **この部品は分母に入っていなかった。**
 *
 * もう 1 つの約束は「**本人にだけ出す**」。サーバーは閲覧者を知らない
 * （静的にも出力される HTML なので知りようがない）ので、描画後に端末の
 * ログイン状態を見て決める。**壊れても画面は動いて見える** ——
 * 他人に出しても、押した先で断られるだけで、画面は正しく描画する。
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const editLink = read('components/edit-link.tsx')

/**
 * 書く面が読んでいる鍵**すべて**。**ここが唯一の出どころ。**
 *
 * `/write/` は 1 つの鍵しか取らないわけではない（`id` で既存を開く・
 * `mode` でヒアリングから始める・`restore` で答えを戻す・`from` で
 * 直前の流れを知る）。**最初は「全部が同じ鍵を使うはず」と書いて、
 * 正しい実装のほうを赤くした。**見たいのはそこではなく、
 * **送っている鍵を、書く面が実際に読んでいるか**（A-4 で壊したのは
 * 「誰も読まない鍵で送っていた」ことだった）。
 */
function writeKeys() {
  const keys = [...read('app/write/page.common.tsx').matchAll(/params\.get\('(\w+)'\)/g)].map(
    (m) => m[1],
  )
  assert.ok(keys.length > 0, '書く面がどの鍵を読んでいるか分からない')
  return new Set(keys)
}

/** 編集の導線が使う鍵（既存の記録を開くもの）。 */
function editKey() {
  const key = /params\.get\('(\w+)'\) \?\? ''/.exec(read('app/write/page.common.tsx'))?.[1]
  assert.ok(key, '既存の記録を開く鍵が分からない')
  return key
}

/** `/write/?…=` を組み立てている面を、探して全部返す（一覧を書き写さない）。 */
function producers() {
  const found = []
  for (const f of [
    ...globSync('app/**/*.tsx', { cwd: ROOT }),
    ...globSync('components/*.tsx', { cwd: ROOT }),
  ]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    for (const m of src.matchAll(/\/write\/\?(\w+)=/g)) found.push([f, m[1]])
  }
  return found
}

test('書く面へ送っている鍵は、すべて書く面が読んでいる（A-4 の再発を止める）', () => {
  const keys = writeKeys()
  const found = producers()
  assert.ok(found.length > 0, '/write/ へ送っている面が 1 つも見つからない')
  const unread = found
    .filter(([, used]) => !keys.has(used))
    .map(([f, used]) => `${f}: ?${used}=`)
  assert.deepEqual(unread, [], `書く面が読まない鍵で送っている（読むのは ${[...keys].join(' ')}）`)
})

test('編集するリンクは、既存の記録を開く鍵で送っている', () => {
  const found = producers().filter(([f]) => f === 'components/edit-link.tsx')
  assert.notDeepEqual(found, [], '編集するリンクが /write/ へ送っていない（導線が消えた）')
  for (const [, used] of found) {
    assert.equal(used, editKey(), '編集の導線が、既存の記録を開く鍵になっていない')
  }
})

// 出す条件は「**閲覧者と作者が同じ人**」。片方を定数にすると誰にでも出る。
test('本人にだけ出す（閲覧者と作者を比べている）', () => {
  const cond = /setMine\((.+)\)/.exec(editLink)
  assert.ok(cond, '出すかどうかを決めている行が無い')
  assert.match(cond[1], /getHandle\(\) === authorHandle/, `比べ方が変わった: ${cond[1]}`)
  assert.match(editLink, /if \(!mine\) return null/, '本人でないときに出さない扱いが無い')
})

/**
 * **決めるのは描画のあと。**静的書き出しの事前描画には端末の保存領域が
 * 無いので、描画中に見ると出来上がった HTML と食い違う。
 * 初期値が `true` だと、**一瞬だけ他人にも「編集する」が見える。**
 */
test('決めるのは画面が出たあと（事前描画と食い違わせない）', () => {
  assert.match(editLink, /useState\(false\)/, '初期値が false でない')
  assert.match(
    editLink,
    /useEffect\(\(\) => \{\s*setMine\(/,
    '描画中に閲覧者を見ている（事前描画と食い違う）',
  )
})

// 記事の面が渡すのは**その記録の作者**。閲覧者側の値を渡すと、比較が
// 常に真になり、誰にでも「編集する」が出る。
test('記事の面は、その記録の作者を渡している', () => {
  const use = /<EditLink([^/]*)\/>/.exec(read('components/story-article.tsx'))
  assert.ok(use, '記事の面が編集するリンクを置いていない')
  assert.match(use[1], /id=\{story\.id\}/, '記録の ID を渡していない')
  assert.match(use[1], /authorHandle=\{story\.authorHandle\}/, 'その記録の作者を渡していない')
})

/**
 * 「あとで読む」が、黙って捨てないこと（設計 U-8）。
 *
 * 上限に当たると**いちばん古い 1 本が落ちる**。落ちること自体は前からの
 * 決まりで、ここでは動かさない（上限を緩めるのは人の判断 — CLAUDE.md）。
 * 直したのは**黙っていたこと**のほう。
 *
 * **数を書き写さない。**この試験に `50` は出てこない。境目は
 * `MAX_SAVED_STORIES` から作る（PR #50・#51 と同じ形）。
 *
 * **落ちる振る舞いそのものは実行で確かめる。**`lib/saved-stories.ts` は
 * 端末の保存領域を使うので、`globalThis.window` に**同じ働きの入れ物**を
 * 置いてから読み込む。ソース検査では「`slice` が在る」までしか言えず、
 * 何本目が落ちるかを縛れない（U-5・A-4 で 2 度踏んだ形）。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

/** 端末の保存領域の代わり。持つのは「入れて出す」だけ。 */
function withBrowser() {
  const box = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (k) => (box.has(k) ? box.get(k) : null),
      setItem: (k, v) => box.set(k, String(v)),
    },
  }
  return box
}

const box = withBrowser()
const saved = await import('../lib/saved-stories.ts')
const { MAX_SAVED_STORIES, savedLimitNotice, savedStoryIds, saveStoryIds, toggleSavedStory } = saved

/** 8 文字の正しい形の ID を、番号から作る。 */
const idAt = (i) => `s${String(i).padStart(7, '0')}`

test('上限に届くまでは、何も言わない', () => {
  assert.equal(savedLimitNotice(MAX_SAVED_STORIES - 1, false), null)
  assert.equal(savedLimitNotice(0, false), null)
})

test('上限に届いたら、押す前に言う（数は上限から作る）', () => {
  const notice = savedLimitNotice(MAX_SAVED_STORIES, false)
  assert.ok(notice, '上限に届いても何も言っていない')
  assert.ok(
    notice.includes(String(MAX_SAVED_STORIES)),
    `いくつまでかを言っていない: ${notice}`,
  )
})

// そこで押すのは**解除**で、何も落ちない。落ちない場面で警告を出すと、
// 出ている警告そのものが読まれなくなる。
test('すでに保存してある Story では言わない', () => {
  assert.equal(savedLimitNotice(MAX_SAVED_STORIES, true), null)
})

test('上限を超えて保存すると、いちばん古い 1 本が落ちる（実行で確かめる）', () => {
  box.clear()
  // いちばん古いものが末尾に来る並びで満杯にする（toggle は先頭へ積む）。
  saveStoryIds(Array.from({ length: MAX_SAVED_STORIES }, (_, i) => idAt(i)))
  const oldest = savedStoryIds().at(-1)
  const fresh = idAt(MAX_SAVED_STORIES)

  // U-15 で返り値が `{ saved, kept }` になった（**残せたか**を呼んだ側が
  // 受け取るため）。ここが見たいのは「押したあとの状態」なので `saved` を見る。
  const pressed = toggleSavedStory(fresh)
  assert.equal(pressed.saved, true, '新しい 1 本が保存されていない')
  assert.equal(pressed.kept, true, '端末に残せていない')
  const after = savedStoryIds()
  assert.equal(after.length, MAX_SAVED_STORIES, '上限を超えて持ってしまっている')
  assert.equal(after[0], fresh, '新しい 1 本が先頭に来ていない')
  assert.ok(!after.includes(oldest), 'いちばん古い 1 本が落ちていない（前提が変わった）')
})

test('落ちる場面では、画面に出す一言が用意されている（同じ状態で聞く）', () => {
  box.clear()
  saveStoryIds(Array.from({ length: MAX_SAVED_STORIES }, (_, i) => idAt(i)))
  const ids = savedStoryIds()
  const fresh = idAt(MAX_SAVED_STORIES)
  assert.ok(
    savedLimitNotice(ids.length, ids.includes(fresh)),
    '落ちる状態なのに、画面へ渡す一言が無い',
  )
})

// 文言も上限も lib から取る。画面に数を書くと、上限を動かしたときに
// **画面だけが古い数を言い続ける**（PR #50 で直したのと同じ形）。
/**
 * **ここから下はソース検査で、実行ではない。**
 *
 * 画面は tsx なので `node --test` から描けない（描くには React を持ち込む
 * ことになり、依存を増やさない決まりに触れる）。だから**形**を見る。
 *
 * **形を見る検査は、識別子が在るだけで通ってしまう**（A-4 で踏んだ形）。
 * 実際、最初は `savedLimitNotice` が在るかどうかだけを見ていて、
 * **描くのをやめる作り変え**と**`null &&` で呼ばなくする作り変え**の
 * 2 方向が緑のまま通った。取り出す行と描く行の**両方**を縛って赤くした。
 * それでも**最後に確かめるのはブラウザ**（この周も実物で見ている）。
 */
test('保存ボタンの面は、一言を lib から取って、そのまま描く', async () => {
  const src = await read('components/save-story.tsx')
  assert.match(
    src,
    /const limitNotice = savedLimitNotice\(/,
    '一言を lib から取っていない（間に何か挟まっている）',
  )
  // **出す条件にしたものを、そのまま出しているか。**条件だけ縛ると、
  // 枠は出るのに中身が空、という作り変えが通ってしまった（実際に通した）。
  const block = src.match(/\{limitNotice && \(([\s\S]*?)\)\}/)
  assert.ok(block, '取った一言を描く条件が無い')
  assert.match(block[1], /\{limitNotice\}/, '条件にした一言を、そのまま描いていない')
})

test('保存ボタンの面は、上限の数を自分で持たない', async () => {
  const src = await read('components/save-story.tsx')
  const inCode = src
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n')
  assert.doesNotMatch(inCode, /\b\d{2,}\b/, '画面が数を自分で書いている')
})

test('保存した面は、読めなくなって外した数を出す', async () => {
  const src = await read('app/saved/page.common.tsx')
  assert.match(src, /setDropped\(missing\.size\)/, '外した数を数えていない')
  assert.match(src, /\{dropped\}/, '外した数を画面に出していない')
})

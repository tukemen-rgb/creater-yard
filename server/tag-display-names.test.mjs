/**
 * タグに出す「書き手が打った書き方」（設計 U-6）。
 *
 * 書き手が `Godot` と打っても、タグは小文字で保存される。**小文字化は
 * 正しい** —— `Godot` と `GODOT` を同じタグに束ねるために要る。変えるのは
 * 画面に出す直前の 1 段だけで、保存の形も絞り込みの鍵も動かさない。
 *
 * **本物の Stories を、本物のファイルに対して動かす。**U-5 で分かったとおり、
 * ソース検査では条件の向きを縛れない。**規則そのものは実行で確かめる。**
 *
 * **SSR 側（lib/stories-read.ts）も実行で確かめる。**Node 22 は型注釈を
 * 剥がして `.ts` をそのまま読めるので、`node --test` から直接 import できる
 * （`server/og.test.mjs` が前からそうしている）。
 *
 * **2026-08-19 の②の設計と⑤の裁定に「TypeScript なので呼べない」と書いたが、
 * 誤りだった。**確かめずに書いた制約で、ソース検査に落としていた。
 * **U-5・U-7 で 2 周続けて踏んだ「ソース検査は条件の中身を縛れない」は、
 * ここでは実行に替えられる。**
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { StoryStore } from './lib/stories.mjs'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

/** 使い捨ての置き場に、指定した Story を書いてから index を取る。 */
function withStories(inputs) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-tags-'))
  try {
    const stories = new StoryStore({ dir })
    const author = { id: 'a'.repeat(16), handle: 'demo_writer' }
    for (const input of inputs) {
      const { status = 'public', ...rest } = input
      stories.create(author, {
        title: '確認のための記録',
        body: '確認のための本文です。十文字を超えます。',
        status,
        ...rest,
      })
    }
    return stories.tagIndex()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('書き方は「使ったツール」欄から採る（タグ側には残っていない）', () => {
  const index = withStories([{ tools: ['Godot'], toolTags: ['Godot'] }])
  assert.deepEqual(index.tools, ['godot'], 'タグの値が小文字でなくなった')
  assert.equal(index.toolNames.godot, 'Godot', '書き方を拾えていない')
})

// 片方を採るのは、書き手のあいだに優劣を作ること。
// **先に書いたほうを採る**も採らない —— 早く書いた人が名前を決める場所に
// しないため。揺れているときは、誰の書き方でもない形に落とす。
test('同じ語に 2 通りの書き方があったら、どちらも採らない', () => {
  const index = withStories([
    { tools: ['Godot'], toolTags: ['Godot'] },
    { tools: ['GODOT'], toolTags: ['GODOT'] },
  ])
  assert.deepEqual(index.tools, ['godot'], '束ねる働きが壊れた')
  assert.equal(index.toolNames.godot, undefined, '揺れているのに片方を採っている')
})

test('「使ったツール」欄が空なら、小文字のまま（推測で名前を作らない）', () => {
  const index = withStories([{ toolTags: ['Godot'] }])
  assert.deepEqual(index.tools, ['godot'])
  assert.equal(index.toolNames.godot, undefined, '書いていない名前を作っている')
})

// 下書きは外に出さない。書き方だけ先に漏れる、が起きないようにする。
test('下書きの「使ったツール」からは作らない', () => {
  const index = withStories([
    { toolTags: ['Godot'] },
    { tools: ['Godot'], toolTags: ['Godot'], status: 'draft' },
  ])
  assert.equal(index.toolNames.godot, undefined, '下書きの中身が対応表に出ている')
})

// 対応表はタグ語彙の中の語だけ。使ったツール欄にしか無い語を足すと、
// 画面に出ないものを配ることになる。
test('対応表に、タグとして存在しない語を入れない', () => {
  const index = withStories([{ tools: ['Blender'], toolTags: ['Godot'] }])
  assert.equal(index.toolNames.blender, undefined, 'タグに無い語まで配っている')
})

test('絞り込みの鍵は小文字のまま（配った URL を壊さない・2 ファイルとも）', async () => {
  for (const page of ['app/tags/page.server.tsx', 'app/tags/page.static.tsx']) {
    const src = await read(page)
    assert.match(src, /\?tool=\$\{encodeURIComponent\(tag\)\}/, `${page}: 絞り込みの鍵が tag でない`)
    assert.doesNotMatch(src, /\?tool=\$\{encodeURIComponent\(\w*[Nn]ame/, `${page}: 表示と鍵を混ぜている`)
  }
})

test('表示だけ差し替えている（2 ファイルとも）', async () => {
  for (const page of ['app/tags/page.server.tsx', 'app/tags/page.static.tsx']) {
    const src = await read(page)
    assert.match(src, /toolNames\?\.\[tag\] \?\? tag/, `${page}: 対応表を引いていない`)
  }
})

/**
 * server/lib/stories.mjs と lib/stories-read.ts は同じ規則を 2 度書いている
 * （byTagName と同じ事情）。片方だけ直すと SSR と静的書き出しで食い違う。
 *
 * **こちらは実行で確かめる。**置き場を env で渡してから読み込む
 * （`DATA_DIR` は読み込みのときに 1 度だけ決まるので、**import より先に
 * 環境変数を置く**）。
 */
async function withSsrIndex(records) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-ssr-'))
  const before = process.env.CY_DATA_DIR
  try {
    mkdirSync(path.join(dir, 'stories'), { recursive: true })
    records.forEach((r, i) => {
      const id = `ssrtest${i}`.slice(0, 8)
      writeFileSync(
        path.join(dir, 'stories', `${id}.json`),
        JSON.stringify({
          id,
          authorHandle: 'demo_writer',
          title: '確認のための記録',
          body: '確認のための本文です。',
          status: 'public',
          publishedAt: `2026-08-1${i}T00:00:00.000Z`,
          toolTags: [],
          topicTags: [],
          tools: [],
          ...r,
        }),
      )
    })
    process.env.CY_DATA_DIR = dir
    const mod = await import(`../lib/stories-read.ts?ssr=${encodeURIComponent(dir)}`)
    return mod.tagIndex()
  } finally {
    if (before === undefined) delete process.env.CY_DATA_DIR
    else process.env.CY_DATA_DIR = before
    rmSync(dir, { recursive: true, force: true })
  }
}

test('SSR 側も、書き方を「使ったツール」欄から採る（実行で確かめる）', async () => {
  const index = await withSsrIndex([{ tools: ['Godot'], toolTags: ['godot'] }])
  assert.deepEqual(index.tools, ['godot'], 'タグの値が小文字でなくなった')
  assert.equal(index.toolNames.godot, 'Godot', 'SSR 側が書き方を拾えていない')
})

test('SSR 側も、揺れているときはどちらも採らない（実行で確かめる）', async () => {
  const index = await withSsrIndex([
    { tools: ['Godot'], toolTags: ['godot'] },
    { tools: ['GODOT'], toolTags: ['godot'] },
  ])
  assert.deepEqual(index.tools, ['godot'], '束ねる働きが壊れた')
  assert.equal(index.toolNames.godot, undefined, '揺れているのに片方を採っている')
})

test('SSR 側も、見つからなければ小文字のまま（実行で確かめる）', async () => {
  const index = await withSsrIndex([{ toolTags: ['godot'] }])
  assert.equal(index.toolNames.godot, undefined, '書いていない名前を作っている')
})

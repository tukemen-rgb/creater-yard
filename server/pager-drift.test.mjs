/**
 * 一覧のページ送りが、SSR（lib/stories-read.ts）と API（server/lib/stories.mjs）で
 * 食い違わないこと。
 *
 * 同じ決まりが 2 か所に書いてある:
 *   - 1 ページの件数 —— `PER_PAGE = 20` と `STORY_LIMITS.perPage = 20`
 *   - 作者の一巡（interleaveAuthors）—— 同じ関数が両方に写してある
 *   - ページ番号の丸め —— `Math.min(Math.max(1, …), totalPages)` が両方に
 *
 * 食い違うと `/stories/?page=2` の HTML と、同じページを API から取った
 * 結果が**別の記録**になる。どちらも壊れて見えないまま、押した先が違う。
 *
 * **数を書き写さない。**この試験の中に `20` は出てこない。1 ページの件数は
 * API 側の定数から取り、記録の数もそこから作る。片方だけ直したときに
 * 赤くなるのが目的で、両方に同じ数を書くのは目的の逆になる
 * （PR #50 と同じ考え。あちらは画面とサーバー、こちらは SSR と API）。
 *
 * **実行で確かめる。**ソース検査は「その識別子が在る」までしか言えない
 * （U-5・A-4 で 2 度踏んだ）。ここは本物のファイルを置いて、両方に
 * 同じページを聞き、返ってきた ID の並びを比べる。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { STORY_LIMITS, StoryStore } from './lib/stories.mjs'

/** 作者が 1 人だと一巡の働きが消えるので、複数人に散らす。 */
const AUTHORS = ['aki_dev', 'bito_maker', 'coro_studio'].map((handle, i) => ({
  id: `${i}`.repeat(16),
  handle,
}))

/**
 * 使い捨ての置き場に公開記録を n 件書き、SSR と API の両方から同じページを取る。
 *
 * 置き場は 1 つ。API の StoryStore は `<dir>/stories` を直接見て、SSR は
 * `CY_DATA_DIR` の下の `stories` を見る —— **同じディレクトリを両方が読む**
 * （本番と同じ形。server/api.mjs と next の server モードがそうしている）。
 *
 * 記録は StoryStore.create で作る。手で JSON を書くと、保存の形が変わった
 * ときに試験だけが古い形を見続けることになる。
 *
 * **中身は受け取った関数の中で見る。**取っ手だけ返して外で使うと、
 * `finally` の後片づけが先に走って**空の置き場を両側が読み、揃っていると
 * 答える**。最初にそう書いて、実際に「0 件と 0 件で一致」で通りかけた
 * （withRepo で踏んだのと同じ形。2 度目）。
 */
async function bothSides(count, body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-pager-'))
  const before = process.env.CY_DATA_DIR
  try {
    let i = 0
    const stories = new StoryStore({
      dir: path.join(dir, 'stories'),
      // **2 件ずつ同じ時刻**にする。全部ばらばらだと公開時刻だけで並びが
      // 決まり、同着のときの決着（ID の比較）を両側とも通らない。
      now: () => Date.UTC(2026, 0, 1) + Math.floor(i / 2) * 60_000,
    })
    // **書き手ごとに固まった順に置く。**交互に置くと、公開時刻の新しい順が
    // そのまま一巡した並びになってしまい、一巡の働きを片方から外しても
    // 結果が変わらない（最初にそう書いて、3 方向の作り変えを取り逃した）。
    const block = Math.ceil(count / AUTHORS.length)
    for (; i < count; i += 1) {
      stories.create(AUTHORS[Math.min(Math.floor(i / block), AUTHORS.length - 1)], {
        title: `確認のための記録 ${i}`,
        body: '確認のための本文です。十文字を超えます。',
        status: 'public',
      })
    }
    process.env.CY_DATA_DIR = dir
    // DATA_DIR は読み込みのときに 1 度だけ決まる（tag-display-names.test.mjs と
    // 同じ事情）。置き場ごとに別の URL にして読み直させる。
    const ssr = await import(`../lib/stories-read.ts?pager=${encodeURIComponent(dir)}`)
    return await body({
      api: (page) => stories.listPublic({ page }),
      ssrList: (page) => ssr.publishedStories({ page }),
      ssrCreator: (handle, page) => ssr.creatorStories(handle, page),
      apiCreator: (handle, page) => stories.listPublic({ handle, page }),
    })
  } finally {
    if (before === undefined) delete process.env.CY_DATA_DIR
    else process.env.CY_DATA_DIR = before
    rmSync(dir, { recursive: true, force: true })
  }
}

const ids = (listing) => listing.stories.map((s) => s.id)

/** 2 ページと端数になる件数。数は API 側の定数から作る（書き写さない）。 */
const COUNT = STORY_LIMITS.perPage * 2 + 1

test('SSR の 1 ページ目の件数は、API が決めた 1 ページの件数と同じ', () =>
  bothSides(COUNT, ({ ssrList }) => {
    assert.equal(
      ssrList(1).stories.length,
      STORY_LIMITS.perPage,
      'SSR が API と違う件数で切っている（PER_PAGE と STORY_LIMITS.perPage がずれた）',
    )
  }))

test('全ページで、SSR と API が同じ記録を同じ順で返す', () =>
  bothSides(COUNT, ({ api, ssrList }) => {
    const pages = api(1).totalPages
    assert.ok(pages > 1, '試験の前提が崩れている（1 ページに収まってしまった）')
    for (let page = 1; page <= pages; page += 1) {
      assert.deepEqual(
        ids(ssrList(page)),
        ids(api(page)),
        `${page} ページ目で SSR と API の中身が食い違う`,
      )
    }
  }))

test('総数・総ページ数も、SSR と API で同じ', () =>
  bothSides(COUNT, ({ api, ssrList }) => {
    const a = api(1)
    const s = ssrList(1)
    assert.equal(a.total, COUNT, '置いた件数を数えられていない（置き場が空のまま比べている）')
    assert.equal(s.total, a.total, '総数が食い違う')
    assert.equal(s.totalPages, a.totalPages, '総ページ数が食い違う')
  }))

// 配った URL の ?page= は人が書き換えられる。範囲外をどちらへ丸めるかが
// 片方だけ違うと、同じ URL で違うページが出る。
test('範囲外のページ番号を、SSR と API が同じところへ丸める', () =>
  bothSides(COUNT, ({ api, ssrList }) => {
    for (const page of [0, -1, api(1).totalPages + 5]) {
      const a = api(page)
      const s = ssrList(page)
      assert.equal(s.page, a.page, `?page=${page} の丸め先が食い違う`)
      assert.deepEqual(ids(s), ids(a), `?page=${page} の中身が食い違う`)
    }
  }))

// 一巡は SSR にも API にも同じ関数が写してある。片方だけ消しても件数は
// 変わらないので、並びを見ないと気づけない。
test('同じ作者が続けて出ない（SSR と API の両方で）', () =>
  bothSides(COUNT, ({ api, ssrList }) => {
    for (const [name, listing] of [['API', api(1)], ['SSR', ssrList(1)]]) {
      const handles = listing.stories.map((s) => s.authorHandle)
      assert.ok(handles.length > 0, `${name}: 1 ページ目が空（比べる中身が無い）`)
      const runs = handles.filter((h, i) => i > 0 && h === handles[i - 1])
      assert.deepEqual(runs, [], `${name}: 同じ作者が続けて並んでいる（一巡が効いていない）`)
    }
  }))

// 書き手のページ（/creators/<handle>/）も同じ切り方で送る。
test('1 人分の一覧も、SSR と API で同じページ送りになる', () =>
  bothSides(COUNT, ({ ssrCreator, apiCreator }) => {
    const handle = AUTHORS[0].handle
    const pages = apiCreator(handle, 1).totalPages
    assert.ok(apiCreator(handle, 1).total > 0, 'この書き手の記録が 1 件も無い')
    for (let page = 1; page <= pages; page += 1) {
      assert.deepEqual(
        ids(ssrCreator(handle, page)),
        ids(apiCreator(handle, page)),
        `${handle} の ${page} ページ目が食い違う`,
      )
    }
  }))

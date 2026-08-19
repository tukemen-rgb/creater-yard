/**
 * 書き手の面（`/creators/<handle>/`）。
 *
 * ③が数えた「どの試験も見ていない画面 10 本」の 3 本目。ページ送りの
 * 部分だけは `pager-drift` / `pager-ui` が見ていたが、**この面がいちばん
 * 気にしている約束は誰も見ていなかった。**
 *
 *   **アカウントの存在を明かさない。**面の註釈にこう書いてある ——
 *   「実在の判定は『公開 Story があるか』で行う。アカウントの存在は
 *   明かさない — ハンドルの総当たり調査に使われる」。
 *
 * つまり **3 つの状態を 1 つの答えに畳む**必要がある:
 *
 *   (a) そんなハンドルの人は居ない
 *   (b) 居るが、まだ 1 本も公開していない
 *   (c) 居たが、公開を全部下げた
 *
 * **どれも同じ 404。**畳めていないと、ハンドルを総当たりして
 * 「誰が居るか」の一覧が作れる。**壊れても画面は動いて見える**
 * （面はちゃんと表示されるので、見ただけでは気づけない）。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { StoryStore } from './lib/stories.mjs'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const page = await read('app/creators/[handle]/creator-page.tsx')

/** 使い捨ての置き場に記録を書き、SSR 側の読み出しを渡す。 */
async function withStories(inputs, body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-creator-'))
  const before = process.env.CY_DATA_DIR
  try {
    let i = 0
    const store = new StoryStore({
      dir: path.join(dir, 'stories'),
      now: () => Date.UTC(2026, 0, 1) + i * 60_000,
    })
    for (; i < inputs.length; i += 1) {
      const { handle, ...rest } = inputs[i]
      store.create(
        { id: handle.padEnd(16, 'x'), handle },
        {
          title: `確認のための記録 ${i}`,
          body: '確認のための本文です。十文字を超えます。',
          status: 'public',
          ...rest,
        },
      )
    }
    process.env.CY_DATA_DIR = dir
    const mod = await import(`../lib/stories-read.ts?creator=${encodeURIComponent(dir)}`)
    return await body(mod)
  } finally {
    if (before === undefined) delete process.env.CY_DATA_DIR
    else process.env.CY_DATA_DIR = before
    rmSync(dir, { recursive: true, force: true })
  }
}

test('その人の公開記録だけが出る（他人のものを混ぜない）', () =>
  withStories([{ handle: 'aki_dev' }, { handle: 'bito_maker' }], (m) => {
    const mine = m.creatorStories('aki_dev')
    assert.equal(mine.total, 1, '件数が合わない')
    assert.deepEqual(
      mine.stories.map((s) => s.authorHandle),
      ['aki_dev'],
      '他人の記録が混ざっている',
    )
  }))

test('下書きは、書き手の面に出ない', () =>
  withStories([{ handle: 'aki_dev', status: 'draft' }, { handle: 'aki_dev' }], (m) => {
    const mine = m.creatorStories('aki_dev')
    assert.equal(mine.total, 1, '下書きが数に入っている')
  }))

/**
 * **3 つの状態が、同じ答えに畳まれているか。**ここが総当たり調査の入口。
 * 「居ない」と「居るが公開が 0」で答えが違うと、公開していない人の
 * ハンドルだけを集められる。
 */
test('居ない人・公開が 0 の人・全部下げた人が、同じ答えになる', () =>
  withStories([{ handle: 'aki_dev', status: 'draft' }], (m) => {
    const nobody = m.creatorStories('nosuchone')
    const draftsOnly = m.creatorStories('aki_dev')
    assert.equal(nobody.total, 0, '居ない人に中身がある')
    assert.equal(
      draftsOnly.total,
      nobody.total,
      '下書きしか無い人と、居ない人で答えが違う（誰が居るか読み取れる）',
    )
  }))

/**
 * ここから下はソース検査（面は tsx なので実行で描けない）。
 * 上で確かめた「0 件」を、面が**どう扱うか**だけを縛る。
 */
test('公開が 0 件なら、面は 404 にする（アカウントの存在を明かさない）', () => {
  assert.match(page, /if \(listing\.total === 0\) notFound\(\)/, '0 件のときに面を出している')
  assert.match(page, /if \(!HANDLE_RE\.test\(handle\)\) notFound\(\)/, 'ハンドルの形を検査していない')
})

// 題名が出ると、404 の面でも「その人が居る」ことが伝わる。
test('0 件のときは、貼られたときのカードも作らない', () => {
  const meta = page.slice(page.indexOf('export async function generateMetadata'))
  assert.match(
    meta,
    /creatorStories\(handle\)\.total === 0\) return \{\}/,
    '0 件でもカードを作っている（題名から存在が漏れる）',
  )
})

// **その人の RSS**（全体 RSS ではない）。ここを取り違えると、
// 「この人を追う」と思って登録した人に、全員分の新着が流れる。
test('その人だけの RSS を、頭にも画面にも出す', () => {
  assert.match(
    page,
    /alternatesFor\(canonical, handleFeedPath\(handle\)\)/,
    '頭の alternate がその人の RSS になっていない',
  )
  assert.match(
    page,
    /<a href=\{handleFeedPath\(handle\)\}>/,
    '画面に見えるリンクとして出ていない（頭だけでは人が気づけない）',
  )
})

// 同じ人の記録が並ぶ面なので、1 枚ごとに名前を繰り返さない。
test('カードに書き手の名前を繰り返さない', () => {
  assert.match(page, /showAuthor=\{false\}/, '同じ人の名前を 1 枚ずつ出している')
})

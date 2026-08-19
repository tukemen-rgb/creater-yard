/**
 * 記事の面（`/story/<id>/`）が寄りかかっている 2 つの関数。
 *
 * ③が 2026-08-19 に画面 35 本を空の部品に置き換えて数えたところ、
 * **記事の面はどの試験も見ていなかった**（10 本のうちの 1 本）。
 * 面そのものは tsx なので実行で描けないが、**面が寄りかかっている関数は
 * `lib/stories-read.ts` に在り、これは実行で確かめられる**
 * （`server/tag-display-names.test.mjs` と同じ手）。
 *
 * ここで見る約束は 2 つ:
 *
 *   1. **下書きは出さない。存在も明かさない**（面の註釈にそう書いてある。
 *      「404 に揃える」＝ 下書きの ID と、そもそも無い ID を**区別させない**）
 *   2. **次の 1 本は、別の作者の・より古い記録**（往復させない・
 *      同じ人の中で回らせない）
 *
 * **どちらも「壊れても画面は動いて見える」形。**下書きが出ても画面は
 * 正しく描画するし、次の 1 本が同じ作者でも読める。だから実行で縛る。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { StoryStore } from './lib/stories.mjs'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

/**
 * 使い捨ての置き場に記録を書き、SSR 側の読み出しを渡す。
 *
 * **中身は受け取った関数の中で見る**（取っ手だけ返すと、後片づけが先に
 * 走って**空の置き場を読んで「一致」と答える**。PR #51 で踏んだ形）。
 */
async function withStories(inputs, body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-story-'))
  const before = process.env.CY_DATA_DIR
  try {
    let i = 0
    const store = new StoryStore({
      dir: path.join(dir, 'stories'),
      now: () => Date.UTC(2026, 0, 1) + i * 60_000,
    })
    const made = []
    for (; i < inputs.length; i += 1) {
      const { handle, ...rest } = inputs[i]
      made.push(
        store.create(
          { id: handle.padEnd(16, 'x'), handle },
          {
            title: `確認のための記録 ${i}`,
            body: '確認のための本文です。十文字を超えます。',
            status: 'public',
            ...rest,
          },
        ),
      )
    }
    process.env.CY_DATA_DIR = dir
    const mod = await import(`../lib/stories-read.ts?story=${encodeURIComponent(dir)}`)
    return await body(mod, made)
  } finally {
    if (before === undefined) delete process.env.CY_DATA_DIR
    else process.env.CY_DATA_DIR = before
    rmSync(dir, { recursive: true, force: true })
  }
}

test('公開した記録は、ID で引ける', () =>
  withStories([{ handle: 'aki_dev' }], (m, made) => {
    assert.equal(m.publishedStory(made[0].id)?.id, made[0].id, '公開した記録が引けない')
  }))

// **下書きは、存在も明かさない。**「下書きだから見せない」と「そんな記録は
// 無い」を区別させると、ID を総当たりして**書きかけの有無だけ**を集められる。
test('下書きは引けない（そんな記録が無いのと同じ答えを返す）', () =>
  withStories([{ handle: 'aki_dev', status: 'draft' }], (m, made) => {
    assert.equal(m.publishedStory(made[0].id), null, '下書きが外へ出ている')
    assert.equal(
      m.publishedStory(made[0].id),
      m.publishedStory('zzzzzzzz'),
      '下書きと「無い記録」で答えが違う（有無を読み取れてしまう）',
    )
  }))

/**
 * ID の形の検査。**「null が返る」だけを見ても足りない** —— 検査を外しても
 * 存在しないファイルは読めず、やはり null が返るので、作り変えが緑のまま
 * 通った（実際に通した）。
 *
 * **見えるようにするには、外したときに答えが変わる ID を渡す。**
 * `../stories/<本物の ID>` は、検査が無ければ置き場の中の本物へ辿り着く。
 */
test('形の違う ID では、ファイルを探しに行かない', () =>
  withStories([{ handle: 'aki_dev' }], (m, made) => {
    for (const bad of ['short', '', 'toolongtoolong', '../../etc/passwd']) {
      assert.equal(m.publishedStory(bad), null, `${bad} に答えている`)
    }
    assert.equal(
      m.publishedStory(`../stories/${made[0].id}`),
      null,
      '置き場の外を指す書き方で、中の記録に辿り着けている',
    )
  }))

test('次の 1 本は、別の作者から選ぶ', () =>
  withStories(
    [{ handle: 'aki_dev' }, { handle: 'bito_maker' }, { handle: 'aki_dev' }],
    (m, made) => {
      const current = m.publishedStory(made[2].id)
      const next = m.nextStoryFromAnotherAuthor(current)
      assert.ok(next, '次の 1 本が選ばれていない')
      assert.notEqual(next.authorHandle, current.authorHandle, '同じ作者を勧めている')
    },
  ))

// 新しいほうへ進むと、2 件のあいだを往復する道ができる。
test('次の 1 本は、いまの記録より古いほうへ進む', () =>
  withStories(
    [{ handle: 'aki_dev' }, { handle: 'bito_maker' }, { handle: 'coro_studio' }],
    (m, made) => {
      const current = m.publishedStory(made[1].id)
      const next = m.nextStoryFromAnotherAuthor(current)
      assert.ok(next, '次の 1 本が選ばれていない')
      assert.ok(
        String(next.publishedAt) < String(current.publishedAt),
        `古いほうへ進んでいない（${next.publishedAt} は ${current.publishedAt} より新しい）`,
      )
    },
  ))

// 候補が居ないときに、無理に勧めない（同じ作者を出す・自分自身を出す）。
test('別の作者が居なければ、勧めない', () =>
  withStories([{ handle: 'aki_dev' }, { handle: 'aki_dev' }], (m, made) => {
    const current = m.publishedStory(made[1].id)
    assert.equal(m.nextStoryFromAnotherAuthor(current), null, '同じ作者しか居ないのに勧めている')
  }))

test('下書きは、次の 1 本に選ばれない', () =>
  withStories(
    [{ handle: 'bito_maker', status: 'draft' }, { handle: 'aki_dev' }],
    (m, made) => {
      const current = m.publishedStory(made[1].id)
      assert.equal(m.nextStoryFromAnotherAuthor(current), null, '下書きを勧めている')
    },
  ))

/**
 * ここから下はソース検査（面は tsx なので実行で描けない）。
 * 縛るのは**上で実行して確かめた約束を、面が実際に使っているか**だけ。
 */
test('記事の面は、公開分が無ければ 404 にする（下書きも同じ扱い）', async () => {
  const src = await read('app/story/[id]/story-page.tsx')
  assert.match(src, /const story = publishedStory\(id\)/, '公開分だけを読む関数を使っていない')
  assert.match(src, /if \(!story\) notFound\(\)/, '無いときに 404 にしていない')
})

// A-6 で実際に踏んだ: openGraph を書くと浅くマージされ、親（layout）の
// og:site_name・og:locale がまるごと消える。
test('記事の面は、貼られたときのカードで親の指定を消さない', async () => {
  const src = await read('app/story/[id]/story-page.tsx')
  const og = src.match(/openGraph: \{([\s\S]*?)\n    \},/)
  assert.ok(og, 'openGraph の指定が読み取れない')
  assert.match(og[1], /\.\.\.SITE_OG/, '親の指定を展開していない（site_name などが消える）')
})

test('記事の面は、正規 URL と貼られたときの URL に同じ値を使う', async () => {
  const src = await read('app/story/[id]/story-page.tsx')
  const name = /const (\w+) = storyUrl\(story\.id\)/.exec(src)
  assert.ok(name, '正規 URL を作っていない')
  assert.match(src, new RegExp(`alternates: alternatesFor\\(${name[1]}\\)`), '正規 URL に使っていない')
  assert.match(src, new RegExp(`url: ${name[1]}`), '貼られたときの URL に同じ値を使っていない')
})

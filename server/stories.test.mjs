import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { Stories, StoryError } from './lib/stories.mjs'

function capture(fn) {
  try {
    fn()
  } catch (err) {
    return err
  }
  assert.fail('例外が投げられるはずだった')
}

const writer = { id: 'author-1', handle: 'writer1' }
const other = { id: 'author-2', handle: 'writer2' }

function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-stories-'))
  const clock = { value: Date.now() }
  const stories = new Stories({ dir: path.join(base, 'stories'), now: () => clock.value })
  return { stories, clock }
}

test('作成 → 取得できる（既定は下書き）', () => {
  const { stories } = setup()
  const created = stories.create({
    author: writer,
    input: { title: '1 日目', body: '敵の動きを作った', tools: ['Godot'] },
  })
  assert.match(created.id, /^[a-f0-9]{16}$/)
  assert.equal(created.visibility, 'draft')
  assert.equal(stories.getVisible(created.id, writer.id).title, '1 日目')
})

test('下書きは他人からは見えない（null = 404 相当）', () => {
  const { stories } = setup()
  const draft = stories.create({ author: writer, input: { title: 't', body: 'b' } })
  assert.equal(stories.getVisible(draft.id, other.id), null)
  assert.equal(stories.getVisible(draft.id), null)
})

test('本人以外の更新は 404（存在も明かさない）', () => {
  const { stories } = setup()
  const draft = stories.create({ author: writer, input: { title: 't', body: 'b' } })
  const err = capture(() =>
    stories.update({ id: draft.id, authorId: other.id, input: { title: 'x', body: 'y' } }),
  )
  assert.ok(err instanceof StoryError)
  assert.equal(err.status, 404)
})

test('公開すると一覧に出て、下書きは出ない', () => {
  const { stories, clock } = setup()
  stories.create({ author: writer, input: { title: '下書き', body: 'b' } })
  clock.value += 1000
  const pub = stories.create({
    author: writer,
    input: { title: '公開分', body: 'b', visibility: 'public' },
  })
  const list = stories.listPublic()
  assert.equal(list.total, 1)
  assert.equal(list.stories[0].id, pub.id)
  // 本人の一覧には両方
  assert.equal(stories.listMine(writer.id).length, 2)
})

test('上限超過とタイトル空は拒否', () => {
  const { stories } = setup()
  assert.throws(() => stories.create({ author: writer, input: { title: '', body: 'b' } }), /タイトル/)
  assert.throws(
    () => stories.create({ author: writer, input: { title: 'x'.repeat(121), body: 'b' } }),
    /120文字/,
  )
  assert.throws(
    () =>
      stories.create({
        author: writer,
        input: { title: 't', body: 'b', tools: Array.from({ length: 11 }, (_, i) => `t${i}`) },
      }),
    /10個/,
  )
})

test('gameyardUrl は GAMEYARD のものだけ保存する', () => {
  const { stories } = setup()
  assert.throws(
    () =>
      stories.create({
        author: writer,
        input: { title: 't', body: 'b', gameyardUrl: 'https://example.com/x' },
      }),
    /play-game-yard\.com/,
  )
  const ok = stories.create({
    author: writer,
    input: { title: 't', body: 'b', gameyardUrl: 'https://play-game-yard.com/games/abc/' },
  })
  assert.ok(ok.gameyardUrl.startsWith('https://play-game-yard.com/'))
})

test('つまずきは状態つきで持て、既定は未解決', () => {
  const { stories } = setup()
  const story = stories.create({
    author: writer,
    input: { title: 't', body: 'b', hurdle: { text: '当たり判定が抜ける' } },
  })
  assert.equal(story.hurdle.status, 'open')
  const resolved = stories.update({
    id: story.id,
    authorId: writer.id,
    input: { title: 't', body: 'b', hurdle: { text: '当たり判定が抜ける', status: 'resolved' } },
  })
  assert.equal(resolved.hurdle.status, 'resolved')
})

test('タグは保存時に正規化され、軸内の重複は 1 つになる', () => {
  const { stories } = setup()
  const story = stories.create({
    author: writer,
    input: {
      title: 't',
      body: 'b',
      tags: { tool: ['  Godot ', 'godot', 'Unity   2022'], topic: ['当たり判定'] },
    },
  })
  assert.deepEqual(story.tags.tool, ['godot', 'unity 2022'])
  assert.deepEqual(story.tags.topic, ['当たり判定'])
})

test('タグの横断絞り込みと語彙（公開分のみ・件数なし）', () => {
  const { stories, clock } = setup()
  stories.create({
    author: writer,
    input: { title: 'ツール側', body: 'b', tags: { tool: ['godot'] }, visibility: 'public' },
  })
  clock.value += 1000
  stories.create({
    author: writer,
    input: { title: 'トピック側', body: 'b', tags: { topic: ['godot'] }, visibility: 'public' },
  })
  stories.create({
    author: writer,
    input: { title: '下書き', body: 'b', tags: { tool: ['secret-tool'] } },
  })

  // 1 語で両軸を横断して引ける
  const hits = stories.listPublic({ tag: 'Godot' })
  assert.equal(hits.total, 2)

  // 語彙は公開分だけ。下書きだけのタグは漏れない
  const vocab = stories.publicTagVocabulary()
  assert.deepEqual(vocab.tool, ['godot'])
  assert.ok(!vocab.tool.includes('secret-tool'))
  // 件数を持たない（名前の配列だけ）
  assert.equal(typeof vocab.tool[0], 'string')
})

test('公開一覧は新着順でページ送りできる', () => {
  const { stories, clock } = setup()
  for (let i = 1; i <= 3; i++) {
    stories.create({
      author: writer,
      input: { title: `no${i}`, body: 'b', visibility: 'public' },
    })
    clock.value += 1000
  }
  const page1 = stories.listPublic({ page: 1, perPage: 2 })
  assert.equal(page1.stories.length, 2)
  assert.equal(page1.stories[0].title, 'no3')
  const page2 = stories.listPublic({ page: 2, perPage: 2 })
  assert.equal(page2.stories.length, 1)
  assert.equal(page2.stories[0].title, 'no1')
})

// ここから下は designs 2026-08-09 13:21 段階 B（14:20 補記）の分。
// PUT は置き換えなので、送らなかった項目は消える。編集画面は全項目を送る。

test('更新: 全項目を送れば公開とタグが保たれる', () => {
  const { stories } = setup()
  const made = stories.create({
    author: writer,
    input: {
      title: 'まえ',
      body: 'ほんぶん',
      tags: { tool: ['Godot'], topic: ['当たり判定'] },
      visibility: 'public',
    },
  })
  const next = stories.update({
    id: made.id,
    authorId: writer.id,
    input: {
      title: 'あと',
      body: 'なおした',
      tags: { tool: ['Godot'], topic: ['当たり判定'] },
      visibility: 'public',
    },
  })
  assert.equal(next.visibility, 'public')
  assert.deepEqual(next.tags.tool, ['godot'])
  assert.deepEqual(next.tags.topic, ['当たり判定'])
  assert.equal(next.title, 'あと')
})

test('更新: visibility を送らないと下書きに戻る（置き換えの証拠）', () => {
  const { stories } = setup()
  const made = stories.create({
    author: writer,
    input: { title: 'まえ', body: 'ほんぶん', visibility: 'public' },
  })
  const next = stories.update({
    id: made.id,
    authorId: writer.id,
    input: { title: 'あと', body: 'なおした' },
  })
  // 画面は全項目を送るのでここには来ない。来たときの挙動を明文化しておく
  assert.equal(next.visibility, 'draft')
})

test('更新: つまずきを空にすると消える', () => {
  const { stories } = setup()
  const made = stories.create({
    author: writer,
    input: {
      title: 't',
      body: 'b',
      hurdle: { text: '当たり判定が抜ける', status: 'open' },
      visibility: 'public',
    },
  })
  assert.equal(made.hurdle.text, '当たり判定が抜ける')

  const cleared = stories.update({
    id: made.id,
    authorId: writer.id,
    input: { title: 't', body: 'b', hurdle: { text: '', status: 'open' }, visibility: 'public' },
  })
  assert.equal(cleared.hurdle, undefined)
})

test('更新: つまずきを送らない場合も消える（置き換えの一貫性）', () => {
  const { stories } = setup()
  const made = stories.create({
    author: writer,
    input: { title: 't', body: 'b', hurdle: { text: 'のこる？', status: 'open' }, visibility: 'public' },
  })
  const next = stories.update({
    id: made.id,
    authorId: writer.id,
    input: { title: 't', body: 'b', visibility: 'public' },
  })
  assert.equal(next.hurdle, undefined)
})

test('更新: つまずきの解決状態だけを変えられる', () => {
  const { stories } = setup()
  const made = stories.create({
    author: writer,
    input: { title: 't', body: 'b', hurdle: { text: 'まだ', status: 'open' }, visibility: 'public' },
  })
  const next = stories.update({
    id: made.id,
    authorId: writer.id,
    input: {
      title: 't',
      body: 'b',
      hurdle: { text: 'まだ', status: 'resolved' },
      visibility: 'public',
    },
  })
  assert.equal(next.hurdle.status, 'resolved')
  assert.equal(next.hurdle.text, 'まだ')
})

test('更新: 他人は更新できない（404 相当）', () => {
  const { stories } = setup()
  const made = stories.create({ author: writer, input: { title: 't', body: 'b' } })
  const err = capture(() =>
    stories.update({ id: made.id, authorId: other.id, input: { title: 'x', body: 'y' } }),
  )
  assert.equal(err.status, 404)
})

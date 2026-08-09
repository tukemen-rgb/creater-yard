/**
 * ビルド時に読む口の試験（designs 2026-08-09 03:22 段階 A-1）。
 *
 * ここで固めたいのは 1 つだけ — **下書きが焼き込まれないこと**。
 * 静的書き出しは一度 out/ に出たら誰でも読めるので、ここが漏れると
 * 認証の有無に関係なく他人の下書きが公開される。
 *
 * 試験の実体は TypeScript（lib/stories-static.ts）を Node の型剥がしで
 * そのまま読む。ビルド用に別の JS を置くと、焼き込む側と試験する側が
 * 別物になり、この試験の意味が薄れる（依存は増やさない決まりもある）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Stories } from './lib/stories.mjs'
import {
  publicHandles,
  publicTags,
  readPublicStories,
  readPublicStory,
} from '../lib/stories-static.ts'

/** CY_DATA_DIR を作業用に差し替えて、その中で書いて読む。 */
function withData(fn, { now } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-static-'))
  const before = process.env.CY_DATA_DIR
  process.env.CY_DATA_DIR = base
  try {
    return fn(new Stories({ dir: path.join(base, 'stories'), ...(now ? { now } : {}) }))
  } finally {
    if (before === undefined) delete process.env.CY_DATA_DIR
    else process.env.CY_DATA_DIR = before
    fs.rmSync(base, { recursive: true, force: true })
  }
}

const AUTHOR = { id: 'author-1', handle: 'hana' }
const OTHER = { id: 'author-2', handle: 'mizuki' }

const base = { title: 'タイトル', body: '本文' }

test('下書きは一覧に出ない', () => {
  withData((store) => {
    store.create({ author: AUTHOR, input: { ...base, title: '公開', visibility: 'public' } })
    store.create({ author: AUTHOR, input: { ...base, title: '下書き', visibility: 'draft' } })

    const titles = readPublicStories().map((story) => story.title)
    assert.deepEqual(titles, ['公開'])
  })
})

test('下書きは id を知っていても取れない', () => {
  withData((store) => {
    const draft = store.create({ author: AUTHOR, input: { ...base, visibility: 'draft' } })
    // 本人の id を渡す口すら無い（ビルド時に閲覧者は居ない）
    assert.equal(readPublicStory(draft.id), null)
  })
})

test('公開 Story は id で取れる', () => {
  withData((store) => {
    const story = store.create({ author: AUTHOR, input: { ...base, visibility: 'public' } })
    assert.equal(readPublicStory(story.id)?.title, 'タイトル')
  })
})

test('存在しない id・不正な id は null（例外にしない）', () => {
  withData(() => {
    assert.equal(readPublicStory('0123456789abcdef'), null)
    assert.equal(readPublicStory('../../etc/passwd'), null)
  })
})

test('新着順（新しいものが先）', () => {
  let clock = 1_000
  withData(
    (store) => {
      store.create({ author: AUTHOR, input: { ...base, title: '古い', visibility: 'public' } })
      store.create({ author: AUTHOR, input: { ...base, title: '新しい', visibility: 'public' } })

      assert.deepEqual(
        readPublicStories().map((story) => story.title),
        ['新しい', '古い'],
      )
    },
    { now: () => (clock += 1000) },
  )
})

test('author / tag で絞れる', () => {
  withData((store) => {
    store.create({
      author: AUTHOR,
      input: { ...base, title: 'hana の', visibility: 'public', tags: { tool: ['Godot'], topic: [] } },
    })
    store.create({ author: OTHER, input: { ...base, title: 'mizuki の', visibility: 'public' } })

    assert.deepEqual(
      readPublicStories({ author: 'hana' }).map((story) => story.title),
      ['hana の'],
    )
    // タグは正規化して突き合わせる（大文字で書かれても引ける）
    assert.deepEqual(
      readPublicStories({ tag: 'godot' }).map((story) => story.title),
      ['hana の'],
    )
  })
})

test('ハンドルとタグの一覧に下書きのものは混ざらない', () => {
  withData((store) => {
    store.create({
      author: AUTHOR,
      input: { ...base, visibility: 'public', tags: { tool: ['godot'], topic: [] } },
    })
    store.create({
      author: OTHER,
      input: { ...base, visibility: 'draft', tags: { tool: ['unity'], topic: ['音'] } },
    })

    assert.deepEqual(publicHandles(), ['hana'])
    assert.deepEqual(publicTags(), ['godot'])
  })
})

test('data/ がまだ無い機械では 0 件（失敗にしない）', () => {
  const before = process.env.CY_DATA_DIR
  process.env.CY_DATA_DIR = path.join(os.tmpdir(), 'cy-static-absent-dir')
  try {
    assert.deepEqual(readPublicStories(), [])
    assert.deepEqual(publicHandles(), [])
    assert.deepEqual(publicTags(), [])
    assert.equal(fs.existsSync(process.env.CY_DATA_DIR), false, '読むだけで data/ を作らない')
  } finally {
    if (before === undefined) delete process.env.CY_DATA_DIR
    else process.env.CY_DATA_DIR = before
  }
})

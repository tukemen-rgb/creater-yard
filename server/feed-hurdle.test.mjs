/**
 * つまずきを、feed の項目にも出す（設計 I-12・2026-08-19 16:40）。
 *
 * ①が実物で測った。カードにも記事にも**つまずき**は出ていて、
 * `components/story-card.tsx` の試験は「**この場所の主役である**」と
 * 書いてある。**feed にだけ出ていなかった。**
 *
 * 読む人にとって feed は「開くかどうか」を決める面である。そこに
 * 本文の 1 文目しか出ないと、**この場の売りが伝わらないまま流れる。**
 *
 * 広げるのは**公開項目の範囲の中**だけ。下書きは入れない・数は出さない・
 * 誰が読んだかは扱わない（2026-08-10 の feed の境界はそのまま）。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildStoriesFeed } from './lib/feed.mjs'

const base = {
  title: 'CreatorYard',
  link: 'https://creatoryard.io/stories/',
  description: '新着',
}
const story = (extra) => ({
  id: 'a'.repeat(8),
  title: '当たり判定を三日疑った話',
  body: '結論から言うと当たり判定は正しかった。移動処理のほうだった。',
  publishedAt: '2026-08-19T00:00:00.000Z',
  ...extra,
})
const descriptionOf = (xml) => /<description>([\s\S]*?)<\/description>/g.exec(xml.split('<item>')[1])?.[1] ?? ''

const withOrigin = (fn) => {
  const before = process.env.CY_SITE_ORIGIN
  process.env.CY_SITE_ORIGIN = 'https://creatoryard.io'
  try { return fn() } finally {
    if (before === undefined) delete process.env.CY_SITE_ORIGIN
    else process.env.CY_SITE_ORIGIN = before
  }
}

test('つまずきがあれば、feed の項目にも出る', () => {
  withOrigin(() => {
    const xml = buildStoriesFeed({
      ...base,
      stories: [story({ hurdle: { status: 'resolved', text: '当たり判定を疑い続けて三日、原因は移動処理だった' } })],
    })
    const d = descriptionOf(xml)
    assert.match(d, /当たり判定を疑い続けて三日/, 'つまずきが出ていない')
    assert.match(d, /結論から言うと/, '本文の抜粋が消えている')
  })
})

// 状態の言い方は画面と同じにする。面ごとに違う言葉を使わない
// （U-5 の「面ごとに違う人格を出さない」と同じ）。
test('状態の言い方が、カードと同じ', () => {
  withOrigin(() => {
    const resolved = descriptionOf(buildStoriesFeed({
      ...base, stories: [story({ hurdle: { status: 'resolved', text: 'なおった' } })],
    }))
    const open = descriptionOf(buildStoriesFeed({
      ...base, stories: [story({ hurdle: { status: 'open', text: 'まだ悩んでいる' } })],
    }))
    assert.match(resolved, /乗り越えた/, 'カードと違う言い方をしている')
    assert.match(open, /悩み中/, 'カードと違う言い方をしている')
  })
})

test('つまずきが無ければ、これまでどおり本文の抜粋だけ', () => {
  withOrigin(() => {
    const d = descriptionOf(buildStoriesFeed({ ...base, stories: [story({})] }))
    assert.match(d, /^結論から言うと/, '無いものの見出しを出している')
    assert.doesNotMatch(d, /乗り越えた|悩み中/, 'つまずきが無いのに状態を出している')
  })
})

// feed は外へ出る一方通行。下書きを入れない境界は 2026-08-10 のまま。
test('下書きは入らない（境界を壊していない）', () => {
  withOrigin(() => {
    const xml = buildStoriesFeed({
      ...base,
      stories: [story({ publishedAt: '', hurdle: { status: 'open', text: '下書きのつまずき' } })],
    })
    assert.doesNotMatch(xml, /下書きのつまずき/, '下書きが feed に出ている')
    assert.doesNotMatch(xml, /<item>/, '下書きの項目が作られている')
  })
})

test('つまずきの文も XML として安全に出る', () => {
  withOrigin(() => {
    const d = descriptionOf(buildStoriesFeed({
      ...base, stories: [story({ hurdle: { status: 'open', text: '<script>と & の混じった話' } })],
    }))
    assert.doesNotMatch(d, /<script>/, 'エスケープされていない')
    assert.match(d, /&lt;script&gt;/, '元の文字が失われている')
    assert.match(d, /&amp;/, 'アンパサンドがエスケープされていない')
  })
})

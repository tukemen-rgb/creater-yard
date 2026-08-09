/**
 * OGP に出す文字列の試験（designs 2026-08-09 22:33 A-2）。
 * 本体は TypeScript（lib/og.ts）を Node の型剥がしでそのまま読む（A-1 と同じ）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { absoluteUrl, ogDescription, tagUrl } from '../lib/og.ts'

test('句点までを 1 文として取る', () => {
  assert.equal(ogDescription('敵の動きを作った。次は音。'), '敵の動きを作った。')
})

test('句点が無ければ本文全体', () => {
  assert.equal(ogDescription('敵の動きを作った'), '敵の動きを作った')
})

test('改行と連続空白は 1 つの空白に潰れる', () => {
  assert.equal(ogDescription('一行目\n二行目'), '一行目 二行目')
  assert.equal(ogDescription('前  後'), '前 後')
})

test('句点が無く長い本文は 200 文字で切って … を付ける', () => {
  const long = 'あ'.repeat(250)
  const out = ogDescription(long)
  assert.equal(out.length, 201, '200 文字＋…')
  assert.ok(out.endsWith('…'))
})

test('1 文目が短ければ、本文がどれだけ長くても切らない', () => {
  const out = ogDescription(`みじかい。${'あ'.repeat(500)}`)
  assert.equal(out, 'みじかい。')
})

test('ちょうど 200 文字（句点なし）は切らない', () => {
  const out = ogDescription('あ'.repeat(200))
  assert.equal(out.length, 200)
  assert.ok(!out.endsWith('…'))
})

// og:url は「恒久的な ID」なので 1 つの形に統一する（事例 36）。
// SITE_ORIGIN の末尾スラッシュの有無で 2 通りにならないこと。
test('og:url は末尾スラッシュ有りに揃う', () => {
  const before = process.env.SITE_ORIGIN
  try {
    for (const origin of ['https://creatoryard.io', 'https://creatoryard.io/']) {
      process.env.SITE_ORIGIN = origin
      assert.equal(absoluteUrl('/s/abc/'), 'https://creatoryard.io/s/abc/')
      assert.equal(absoluteUrl('/s/abc'), 'https://creatoryard.io/s/abc/')
    }
  } finally {
    if (before === undefined) delete process.env.SITE_ORIGIN
    else process.env.SITE_ORIGIN = before
  }
})

test('SITE_ORIGIN が無ければ null（それらしい嘘の URL を作らない）', () => {
  const before = process.env.SITE_ORIGIN
  try {
    delete process.env.SITE_ORIGIN
    assert.equal(absoluteUrl('/s/abc/'), null)
    process.env.SITE_ORIGIN = '   '
    assert.equal(absoluteUrl('/s/abc/'), null)
  } finally {
    if (before === undefined) delete process.env.SITE_ORIGIN
    else process.env.SITE_ORIGIN = before
  }
})

// ここから下は designs 2026-08-10 00:34（A-3）の分。
// タグには日本語が入る。encode を 1 か所に閉じたことの確認。

function withOrigin(origin, fn) {
  const before = process.env.SITE_ORIGIN
  try {
    if (origin === null) delete process.env.SITE_ORIGIN
    else process.env.SITE_ORIGIN = origin
    fn()
  } finally {
    if (before === undefined) delete process.env.SITE_ORIGIN
    else process.env.SITE_ORIGIN = before
  }
}

test('tagUrl: ASCII のタグ', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(tagUrl('godot'), 'https://creatoryard.io/tags/godot/')
  })
})

test('tagUrl: 日本語のタグは percent-encode される', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(
      tagUrl('当たり判定'),
      'https://creatoryard.io/tags/%E5%BD%93%E3%81%9F%E3%82%8A%E5%88%A4%E5%AE%9A/',
    )
  })
})

// / を含むタグがそのまま乗ると、経路が 1 つ増えてしまう（別のページを指す）
test('tagUrl: / を含むタグは経路を割らない', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(tagUrl('a/b'), 'https://creatoryard.io/tags/a%2Fb/')
  })
  withOrigin('https://creatoryard.io', () => {
    assert.equal(tagUrl('../secret'), 'https://creatoryard.io/tags/..%2Fsecret/')
  })
})

test('tagUrl: SITE_ORIGIN が無ければ null', () => {
  withOrigin(null, () => assert.equal(tagUrl('godot'), null))
})

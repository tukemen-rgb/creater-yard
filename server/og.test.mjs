/**
 * OGP に出す文字列の試験（designs 2026-08-09 22:33 A-2）。
 * 本体は TypeScript（lib/og.ts）を Node の型剥がしでそのまま読む（A-1 と同じ）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  absoluteUrl,
  alternatesFor,
  fileUrl,
  handleFeedPath,
  handleUrl,
  ogDescription,
  SITE_OG,
  storyUrl,
  tagUrl,
} from '../lib/og.ts'

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
// CY_SITE_ORIGIN の末尾スラッシュの有無で 2 通りにならないこと。
test('og:url は末尾スラッシュ有りに揃う', () => {
  const before = process.env.CY_SITE_ORIGIN
  try {
    for (const origin of ['https://creatoryard.io', 'https://creatoryard.io/']) {
      process.env.CY_SITE_ORIGIN = origin
      assert.equal(absoluteUrl('/s/abc/'), 'https://creatoryard.io/s/abc/')
      assert.equal(absoluteUrl('/s/abc'), 'https://creatoryard.io/s/abc/')
    }
  } finally {
    if (before === undefined) delete process.env.CY_SITE_ORIGIN
    else process.env.CY_SITE_ORIGIN = before
  }
})

test('CY_SITE_ORIGIN が無ければ null（それらしい嘘の URL を作らない）', () => {
  const before = process.env.CY_SITE_ORIGIN
  try {
    delete process.env.CY_SITE_ORIGIN
    assert.equal(absoluteUrl('/s/abc/'), null)
    process.env.CY_SITE_ORIGIN = '   '
    assert.equal(absoluteUrl('/s/abc/'), null)
  } finally {
    if (before === undefined) delete process.env.CY_SITE_ORIGIN
    else process.env.CY_SITE_ORIGIN = before
  }
})

// ここから下は designs 2026-08-10 00:34（A-3）の分。
// タグには日本語が入る。encode を 1 か所に閉じたことの確認。

function withOrigin(origin, fn) {
  const before = process.env.CY_SITE_ORIGIN
  try {
    if (origin === null) delete process.env.CY_SITE_ORIGIN
    else process.env.CY_SITE_ORIGIN = origin
    fn()
  } finally {
    if (before === undefined) delete process.env.CY_SITE_ORIGIN
    else process.env.CY_SITE_ORIGIN = before
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

test('tagUrl: CY_SITE_ORIGIN が無ければ null', () => {
  withOrigin(null, () => assert.equal(tagUrl('godot'), null))
})

// designs 2026-08-10 02:33（A-4）の分。

test('handleUrl / storyUrl は末尾スラッシュ有り', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(handleUrl('hana'), 'https://creatoryard.io/w/hana/')
    assert.equal(storyUrl('0123456789abcdef'), 'https://creatoryard.io/s/0123456789abcdef/')
  })
})

// ここを absoluteUrl でやると …/sitemap.xml/ になり、robots.txt が
// 指す先が辿れなくなる（sitemap を見つけてもらえない）
test('fileUrl は末尾スラッシュを付けない', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(fileUrl('/sitemap.xml'), 'https://creatoryard.io/sitemap.xml')
  })
})

test('handleUrl / storyUrl / fileUrl も CY_SITE_ORIGIN が無ければ null', () => {
  withOrigin(null, () => {
    assert.equal(handleUrl('hana'), null)
    assert.equal(storyUrl('0123456789abcdef'), null)
    assert.equal(fileUrl('/sitemap.xml'), null)
  })
})

// designs 2026-08-10 06:33（A-6）の分。
// Next.js の metadata は shallow merge なので、子で alternates / openGraph を
// 書くと親の入れ子が丸ごと消える（事例 41）。共有分の出どころを 1 つにした
// ことの確認。**ここが崩れると RSS の自動発見が焼いたページから消える。**

test('alternatesFor: canonical が無ければ鍵ごと出さない', () => {
  const a = alternatesFor(null)
  assert.deepEqual(a.types, { 'application/rss+xml': '/stories/feed.xml' })
  assert.ok(!('canonical' in a), 'canonical の鍵が在る')
})

test('alternatesFor: canonical と RSS の両方が入る', () => {
  const a = alternatesFor('https://creatoryard.io/s/x/')
  assert.equal(a.canonical, 'https://creatoryard.io/s/x/')
  assert.deepEqual(a.types, { 'application/rss+xml': '/stories/feed.xml' })
})

test('alternatesFor: 個人ページは本人のフィードを指せる', () => {
  const a = alternatesFor('https://creatoryard.io/w/hana/', handleFeedPath('hana'))
  assert.deepEqual(a.types, { 'application/rss+xml': '/w/hana/feed.xml' })
})

test('SITE_OG に siteName と locale が在る（type は入れない）', () => {
  assert.equal(SITE_OG.siteName, 'CreatorYard')
  assert.equal(SITE_OG.locale, 'ja_JP')
  // layout は website、Story は article。共有に混ぜると黙って変わる
  assert.ok(!('type' in SITE_OG), 'type が共有分に入っている')
})

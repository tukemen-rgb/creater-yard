import assert from 'node:assert/strict'
import test from 'node:test'

import {
  absoluteUrl,
  alternatesFor,
  fileUrl,
  handleFeedPath,
  handleUrl,
  ogDescription,
  SITE_FEED,
  SITE_OG,
  storyUrl,
  tagUrl,
} from '../lib/og.ts'

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

test('OG description は最初の一文を取り、空白を正規化する', () => {
  assert.equal(ogDescription('敵の動きを作った。次は音。'), '敵の動きを作った。')
  assert.equal(ogDescription('一行目\n二行目'), '一行目 二行目')
})

test('句点のない長文は 200 文字と省略記号に制限する', () => {
  const out = ogDescription('あ'.repeat(250))
  assert.equal(out.length, 201)
  assert.ok(out.endsWith('…'))
  assert.equal(ogDescription('あ'.repeat(200)).length, 200)
})

test('絶対 URL は origin の末尾に関係なく末尾スラッシュを一つに揃える', () => {
  for (const origin of ['https://creatoryard.io', 'https://creatoryard.io/']) {
    withOrigin(origin, () => {
      assert.equal(absoluteUrl('/story/abc'), 'https://creatoryard.io/story/abc/')
    })
  }
})

test('origin 未設定時は仮の絶対 URL を作らない', () => {
  withOrigin(null, () => {
    assert.equal(absoluteUrl('/story/abc/'), null)
    assert.equal(handleUrl('hana'), null)
    assert.equal(storyUrl('0123456789abcdef'), null)
    assert.equal(fileUrl('/sitemap.xml'), null)
  })
  withOrigin('   ', () => assert.equal(absoluteUrl('/story/abc/'), null))
})

test('タグ URL は日本語と slash を一つの segment に encode する', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(
      tagUrl('当たり判定'),
      'https://creatoryard.io/tags/%E5%BD%93%E3%81%9F%E3%82%8A%E5%88%A4%E5%AE%9A/',
    )
    assert.equal(tagUrl('a/b'), 'https://creatoryard.io/tags/a%2Fb/')
  })
})

test('Story・作者・RSS は公開済みの正規経路だけを返す', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(handleUrl('hana'), 'https://creatoryard.io/creators/hana/')
    assert.equal(storyUrl('0123456789abcdef'), 'https://creatoryard.io/story/0123456789abcdef/')
  })
  assert.equal(SITE_FEED, '/api/feeds/stories.xml')
  assert.equal(handleFeedPath('hana'), '/api/feeds/creators/hana.xml')
  assert.ok(!SITE_FEED.includes('/stories/feed.xml'))
  assert.ok(!handleFeedPath('hana').includes('/w/'))
})

test('file URL は末尾スラッシュを付けない', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(fileUrl('/sitemap.xml'), 'https://creatoryard.io/sitemap.xml')
  })
})

test('alternates は RSS を常に保ち、canonical は設定済みの場合だけ出す', () => {
  const withoutCanonical = alternatesFor(null)
  assert.deepEqual(withoutCanonical.types, { 'application/rss+xml': SITE_FEED })
  assert.ok(!('canonical' in withoutCanonical))

  const canonical = 'https://creatoryard.io/story/x/'
  const withCanonical = alternatesFor(canonical)
  assert.equal(withCanonical.canonical, canonical)
  assert.deepEqual(withCanonical.types, { 'application/rss+xml': SITE_FEED })

  const creator = alternatesFor(
    'https://creatoryard.io/creators/hana/',
    handleFeedPath('hana'),
  )
  assert.deepEqual(creator.types, {
    'application/rss+xml': '/api/feeds/creators/hana.xml',
  })
})

test('SITE_OG は共有項目だけを持つ', () => {
  assert.equal(SITE_OG.siteName, 'CreatorYard')
  assert.equal(SITE_OG.locale, 'ja_JP')
  assert.ok(!('type' in SITE_OG))
})

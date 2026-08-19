import assert from 'node:assert/strict'
import test from 'node:test'

import {
  absoluteUrl,
  alternatesFor,
  fileUrl,
  handleFeedPath,
  handleUrl,
  ogDescription,
  ogWithUrl,
  SITE_FEED,
  SITE_OG,
  storiesFilterUrl,
  storiesListPath,
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

test('タグで絞った一覧の canonical は 1 本に正規化する', () => {
  withOrigin('https://creatoryard.io', () => {
    // 絞り込みなしは一覧そのもの
    assert.equal(storiesFilterUrl(), 'https://creatoryard.io/stories/')
    assert.equal(storiesFilterUrl('', ''), 'https://creatoryard.io/stories/')

    // 軸ごとに 1 本
    assert.equal(storiesFilterUrl('Godot'), 'https://creatoryard.io/stories/?tool=godot')
    assert.equal(storiesFilterUrl('', '影'), 'https://creatoryard.io/stories/?topic=%E5%BD%B1')

    // 両方指定は AND 絞り込みなので両方を残し、順序を固定する
    assert.equal(
      storiesFilterUrl('Godot', '影'),
      'https://creatoryard.io/stories/?tool=godot&topic=%E5%BD%B1',
    )

    // 1 ページ目は省略し、内容が異なる 2 ページ目以降は自己 canonical にする
    assert.equal(storiesFilterUrl('Godot', '', '1'), 'https://creatoryard.io/stories/?tool=godot')
    assert.equal(
      storiesFilterUrl('Godot', '', '2'),
      'https://creatoryard.io/stories/?tool=godot&page=2',
    )

    // 一覧の照合と同じく NFKC・小文字・前後空白除去で表記揺れを束ねる
    assert.equal(storiesFilterUrl('  '), 'https://creatoryard.io/stories/')
    assert.equal(storiesFilterUrl(' Ｇｏｄｏｔ '), 'https://creatoryard.io/stories/?tool=godot')

    // 保存できない長さのタグには canonical を出さない（<head> を膨らませない）
    assert.equal(storiesFilterUrl('あ'.repeat(25)), null)
    assert.ok(storiesFilterUrl('あ'.repeat(24)))

    // 山括弧やクォートは encode されて属性値を割らない
    const injected = storiesFilterUrl('"><script>')
    assert.ok(!injected.includes('<'))
    assert.ok(!injected.includes('"'))
  })

  // origin 未設定なら canonical を作らない（仮 URL を出さない）
  withOrigin(null, () => {
    assert.equal(storiesFilterUrl('Godot'), null)
    assert.equal(storiesFilterUrl(), null)
  })
})

test('ページ送りのリンクは絞り込み条件を落とさない（gdp 2026-08-14 の指摘）', () => {
  // 1. tool のみ
  assert.equal(storiesListPath('Godot', '', 2), '/stories/?tool=Godot&page=2')
  // 2. topic のみ
  assert.equal(storiesListPath('', '影', 2), '/stories/?topic=%E5%BD%B1&page=2')
  // 3. 両方 —— これが本題。以前は topic が消えていた
  assert.equal(storiesListPath('Godot', '影', 2), '/stories/?tool=Godot&topic=%E5%BD%B1&page=2')
  // 4. 予約文字・日本語が encode され、クエリの区切りを壊さない
  const tricky = storiesListPath('a&b=c', "' onmouseover='x", 3)
  assert.ok(!tricky.includes('&b=c&'), '値の & が区切りにならない')
  assert.ok(!tricky.includes("'"), "シングルクォートも encode される")
  assert.equal((tricky.match(/=/g) ?? []).length, 3, '= は 3 つ（tool/topic/page）だけ')
  // 5. 前へ／次へで同じ条件が維持される（page だけが変わる）
  const prev = storiesListPath('Godot', '影', 1)
  const next = storiesListPath('Godot', '影', 3)
  assert.equal(prev, '/stories/?tool=Godot&topic=%E5%BD%B1', '1 ページ目は page を省略')
  assert.equal(next, '/stories/?tool=Godot&topic=%E5%BD%B1&page=3')
  // 表記は利用者が打ったまま運ぶ（正規化は canonical の仕事。照合は一覧側がやる）
  assert.ok(storiesListPath('GODOT', '', 2).includes('tool=GODOT'))
  // 条件なしは素の一覧
  assert.equal(storiesListPath('', '', 1), '/stories/')
})

/**
 * 子で `openGraph` を書くときの取りこぼしを、呼ぶ側から取り上げる関数
 * （設計 A・2026-08-19 10:30）。
 *
 * `app/layout.common.tsx` の註釈は「必ず `...SITE_OG` を展開すること」と
 * 名指ししているが、**この罠はこの repo で 2 回踏まれている。**
 * 註釈で守れていないので、展開を関数の中に入れる。
 */
test('共有カードの土台は、サイト共通の項目を必ず連れてくる', () => {
  withOrigin('https://creatoryard.io', () => {
    const og = ogWithUrl(absoluteUrl('/'), 'website')
    for (const [key, value] of Object.entries(SITE_OG)) {
      assert.equal(og[key], value, `${key} が落ちている`)
    }
    assert.equal(og.type, 'website')
    assert.equal(og.url, 'https://creatoryard.io/')
  })
})

// **`undefined` を入れない。**`{ url: undefined }` は焼く側が拾って
// 空の og:url になりうる。「無い URL を指すより、出さないほうがまし」
// （2026-08-09 に og:image で決めたのと同じ理屈）。
test('公開オリジンが無いときは、url をキーごと出さない', () => {
  withOrigin(null, () => {
    const og = ogWithUrl(absoluteUrl('/'), 'website')
    assert.ok(!('url' in og), 'url のキーが残っている')
    assert.equal(og.type, 'website')
    assert.equal(og.siteName, SITE_OG.siteName, 'サイト名まで落ちている')
  })
})

test('type は渡したものがそのまま入る', () => {
  withOrigin('https://creatoryard.io', () => {
    assert.equal(ogWithUrl(absoluteUrl('/x/'), 'article').type, 'article')
    assert.equal(ogWithUrl(null, 'profile').type, 'profile')
  })
})

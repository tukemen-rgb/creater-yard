/**
 * **一覧の抜粋が、定型の見出しから始まらないこと**（U-17）。
 *
 * ヒアリングから書いた本文は必ずこう始まる:
 *
 *   【つくっているもの】
 *   古い動物園を探索するホラーゲーム
 *
 *   【今日試したこと】
 *   …
 *
 * 一覧で見られているのは**頭の 2 語ほど**（事例 88・NN/g）なので、
 * そこが定型で埋まると、**どの記録も同じ顔になる。**
 *
 * **抜粋を作る場所は 2 か所ある**（②が数えた）:
 *
 *   components/story-card.tsx … 120 字。画面 5 面
 *   server/lib/feed.mjs      … 200 字。RSS 2 本
 *
 * **この 2 つはコードを共有できない**（Next が束ねる TS と、素の `.mjs`）。
 * だから**振る舞いで突き合わせる** —— 片方だけ直したときに赤くなるように。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

// **`.tsx` は素の Node が読めない**（JSX の型剥がしは効かない）。
// だから切り出しの規則は `lib/story-excerpt.ts` に置き、画面はそれを使う。
const card = await import('../lib/story-excerpt.ts?u17')
const feed = await import('./lib/feed.mjs')

/** ヒアリングが実際に作る形（`lib/story-interview.ts` と同じ組み立て）。 */
const INTERVIEW_BODY = [
  '【つくっているもの】\n古い動物園を探索するホラーゲーム',
  '【今日試したこと】\n追いかけてくる敵の動きを調整した',
  '【次に試すこと】\n当たり判定を見直して、もう一度テストする',
].join('\n\n')

test('画面側: 抜粋が見出しから始まらない', () => {
  const source = card.excerptSource(INTERVIEW_BODY)
  assert.ok(!source.startsWith('【'), `見出しから始まっている: ${source.slice(0, 20)}`)
  assert.ok(source.startsWith('古い動物園'), `中身の行から始まっていない: ${source.slice(0, 20)}`)
})

/** RSS の item に実際に出る description（**道具ではなく、出るものを見る**）。 */
function itemDescription(body) {
  const xml = feed.buildStoriesFeed({
    title: 'т',
    link: 'https://example.test/stories/',
    description: 'せつめい',
    stories: [
      {
        id: 'aaaaaaaa',
        title: '題',
        body,
        hurdle: null,
        publishedAt: '2026-08-20T00:00:00.000Z',
        authorHandle: 'aki_dev',
      },
    ],
  })
  const all = [...xml.matchAll(/<description>([\s\S]*?)<\/description>/g)].map((x) => x[1])
  assert.ok(all[1], 'item の description が出ていない')
  return all[1]
}

test('RSS 側: description が見出しから始まらない', () => {
  const xml = feed.buildStoriesFeed({
    title: 'т',
    link: 'https://example.test/stories/',
    description: 'せつめい',
    stories: [
      {
        id: 'aaaaaaaa',
        title: '題',
        body: INTERVIEW_BODY,
        hurdle: null,
        publishedAt: '2026-08-20T00:00:00.000Z',
        authorHandle: 'aki_dev',
      },
    ],
  })
  const m = /<description>([\s\S]*?)<\/description>/g
  const all = [...xml.matchAll(m)].map((x) => x[1])
  // 1 つ目は channel の説明。2 つ目からが item
  const item = all[1]
  assert.ok(item, 'item の description が出ていない')
  assert.ok(!item.startsWith('【'), `見出しから始まっている: ${item.slice(0, 20)}`)
})

/**
 * **ここが本題。**2 か所は輸入し合えないので、**同じ入力に同じ始まり**が
 * 出ることで揃っていると見なす。長さの違い（120 と 200）はそのままでよい。
 *
 * **最初の版は、この試験が効かなかった。**両側の `excerptSource` どうしを
 * 比べていたので、**RSS が `excerptSource` を使うのをやめても緑のまま**だった
 * （規則 5-2 の「穴 B」を作って気づいた）。
 * **道具どうしではなく、実際に出るものを比べる。**
 */
test('画面と RSS が、同じところから始まる', () => {
  const fromCard = card.excerptSource(INTERVIEW_BODY).slice(0, 20)
  const fromFeed = itemDescription(INTERVIEW_BODY).slice(0, 20)
  assert.equal(fromFeed, fromCard, '片方だけ直っている（画面と RSS で違う顔になる）')
})

test('文中の見出しは壊さない', () => {
  const body = '【重要】ここが肝\nそのあとの話'
  // 行まるごとが `【…】` ではないので、飛ばさない
  assert.ok(card.excerptSource(body).startsWith('【重要】'), '正当な本文を削っている')
  assert.ok(feed.excerptSource(body).startsWith('【重要】'), '正当な本文を削っている（RSS）')
})

test('見出ししか無い本文でも、空にしない', () => {
  const body = '【あ】\n【い】\n【う】'
  assert.ok(card.excerptSource(body).length > 0, '抜粋が空になっている')
  assert.ok(feed.excerptSource(body).length > 0, '抜粋が空になっている（RSS）')
})

test('見出しが続きすぎる本文では、頭から遠くへ行かない', () => {
  const body = ['【1】', '【2】', '【3】', '【4】', '【5】', '【6】', '本文'].join('\n')
  // 5 行までしか飛ばさないので、6 行目の見出しが残る（末尾から始めない）
  assert.ok(card.excerptSource(body).startsWith('【6】'), '頭から遠くまで飛ばしている')
})

/**
 * ホーム背景動画（Issue #12）のソース検査。
 *
 * 実行: node --test server/home-hero.test.mjs
 * package.json の test:server への登録は、同じ行を触る PR #11 のマージ後に
 * 1 行で行う（開いている PR と変更ファイルを重ねないため）。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../app/page.common.tsx', import.meta.url), 'utf8')
const videoComponent = await readFile(new URL('../app/hero-video.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

/**
 * src / poster の値を、素の文字列とテンプレート文字列の両方から拾う。
 * O-4 で版（?v=）を付けたので、値は `{`...`}` の形にもなる。
 */
const mediaRefs = (source) =>
  [...source.matchAll(/(?:src|poster)=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2])

test('video は無音自動再生・ループ・インライン再生・装飾扱いで組む', () => {
  const video = videoComponent.match(/<video[\s\S]*?>/)?.[0] ?? ''
  for (const attr of ['autoPlay', 'muted', 'loop', 'playsInline', 'aria-hidden="true"', 'preload="metadata"']) {
    assert.ok(video.includes(attr), `video 要素に ${attr} が無い`)
  }
  assert.ok(
    mediaRefs(video).some((ref) => ref.startsWith('/media/hero-poster')),
    'poster が /media/ 配下でない',
  )
})

test('動画の参照はすべて自ホストの /media/ 配下（第三者 URL を機械的に禁止）', () => {
  const refs = mediaRefs(videoComponent)
  assert.ok(refs.length >= 2, '動画参照が見つからない')
  for (const ref of refs) {
    assert.ok(ref.startsWith('/media/'), `自ホスト外の参照: ${ref}`)
  }
  assert.doesNotMatch(videoComponent, /<(?:video|source)[^>]*(?:src|poster)="https?:/, '第三者 URL の動画参照がある')
  assert.doesNotMatch(videoComponent, /(?:src|poster)=\{`https?:/, '第三者 URL の動画参照がある')
})

// O-4。同じ URL のまま中身だけ差し替えると、CDN と利用者のブラウザに古い
// 複製が残り続ける（事例 64）。版を URL に付けて別物にする。
// **緩めるのは「?v= が付いてよい」だけで、/media/ 前方一致は緩めない。**
// ここを雑にすると、第三者 URL の禁止が一緒に外れる。
test('素材の参照には版が付く（差し替えたら別の URL になる）', () => {
  const refs = mediaRefs(videoComponent)
  assert.ok(refs.length >= 2, '動画参照が見つからない')
  for (const ref of refs) {
    assert.match(ref, /\?v=\$\{/, `版が付いていない参照: ${ref}`)
  }
})

test('版はファイルのサイズから作る（人が書いた定数にしない）', () => {
  assert.match(page, /statSync[\s\S]{0,160}?size/, '版をファイルのサイズから作っていない')
  assert.doesNotMatch(page, /version=\{\s*\d/, '版が人の書いた定数になっている')
  assert.doesNotMatch(page, /const\s+\w*[Vv]ersion\w*\s*=\s*['"`]?\d/, '版が人の書いた定数になっている')
})

// CSS の背景画像には版を付けられない（ビルド時の値を差し込めない）。
// 付けないこと自体は壊れないが、**なぜ付けないのか**が書いていないと、
// 次に触る人が「付け忘れ」と読んで直そうとする。理由を縛る。
test('CSS の poster には版を付けず、その理由がそばに書いてある', () => {
  assert.doesNotMatch(css, /hero-poster\.jpg\?/, 'CSS の背景画像に版が付いている')
  const reason = css.indexOf('CSS はビルド時の値を差し込めない')
  const posterUse = css.indexOf("url('/media/hero-poster.jpg')")
  assert.ok(reason >= 0, '版を付けない理由が CSS に書かれていない')
  assert.ok(posterUse > reason && posterUse - reason < 400, '理由が poster の指定から離れている')
})

test('素材ゲート: 素材が無いビルドでは video 要素を出さない', () => {
  assert.match(page, /fs\.existsSync/, 'ビルド時のファイル存在判定が無い')
  assert.match(page, /RIGHTS_APPROVED/, '権利確認が済む前にも動画を出せる')
  assert.match(page, /rightsApproved && fs\.existsSync/, '権利確認を video の素材ゲートに使っていない')
  assert.match(page, /\{hasHeroVideo && \(/, '存在判定で video の出力を分けていない')
})

test('prefers-reduced-motion では video を生成せず poster に落とす', () => {
  assert.match(
    videoComponent,
    /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/,
    'reduced-motion の利用者設定を確認していない',
  )
  assert.match(videoComponent, /useState\(false\)/, '設定確認前に video を生成しうる')
  assert.match(videoComponent, /if \(!canAnimate\) return null/, 'reduced-motion でも video が残る')
  assert.match(
    css,
    /\.hero--video \{[\s\S]*?hero-poster\.jpg/,
    'poster フォールバックが無い',
  )
})

test('5 秒を超えてループする動画を一時停止・再開できる', () => {
  assert.match(videoComponent, /video\.pause\(\)/, '一時停止操作が無い')
  assert.match(videoComponent, /video\.play\(\)/, '再開操作が無い')
  assert.match(videoComponent, /背景動画を一時停止/, '一時停止ボタンの名前が無い')
  assert.match(videoComponent, /背景動画を再生/, '再生ボタンの名前が無い')
})

test('文字コントラスト用のオーバーレイがある', () => {
  assert.match(css, /\.hero--video::before \{[\s\S]*?linear-gradient/, '暗いオーバーレイが無い')
})

// ④ 21:10 の指摘 1。<source> は webm → mp4 の順なので、VP9 を解せる browser
// （Chrome・Firefox＝大多数）は webm を取る。**先に並べたほうが小さい**という
// 不変条件が崩れると、多くの利用者だけが黙って重いファイルを掴む。
// 実際に 1080p へ焼き直したとき、VP9 の CRF を H.264 と釣り合うと見なして
// この条件を破った（webm 7.9MB > mp4 7.0MB）。人の注意ではなく試験で守る。
test('先に並べた webm は mp4 より小さい（大多数が重いほうを掴まない）', async () => {
  const { stat } = await import('node:fs/promises')
  const size = async (name) =>
    (await stat(new URL(`../public/media/${name}`, import.meta.url))).size

  const order = mediaRefs(videoComponent)
    .map((ref) => /^\/media\/(hero\.\w+)\?/.exec(ref)?.[1])
    .filter(Boolean)
  assert.deepEqual(order, ['hero.webm', 'hero.mp4'], 'source の並び順が変わった')

  const [webm, mp4] = [await size('hero.webm'), await size('hero.mp4')]
  assert.ok(
    webm < mp4,
    `先に並べた hero.webm（${(webm / 1e6).toFixed(2)}MB）が hero.mp4（${(mp4 / 1e6).toFixed(2)}MB）より大きい`,
  )
})

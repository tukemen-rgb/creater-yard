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

test('video は無音自動再生・ループ・インライン再生・装飾扱いで組む', () => {
  const video = videoComponent.match(/<video[\s\S]*?>/)?.[0] ?? ''
  for (const attr of ['autoPlay', 'muted', 'loop', 'playsInline', 'aria-hidden="true"', 'preload="metadata"']) {
    assert.ok(video.includes(attr), `video 要素に ${attr} が無い`)
  }
  assert.match(video, /poster="\/media\//, 'poster が /media/ 配下でない')
})

test('動画の参照はすべて自ホストの /media/ 配下（第三者 URL を機械的に禁止）', () => {
  const refs = [...videoComponent.matchAll(/(?:src|poster)="([^"]+)"/g)].map((m) => m[1])
  assert.ok(refs.length >= 2, '動画参照が見つからない')
  for (const ref of refs) {
    assert.ok(ref.startsWith('/media/'), `自ホスト外の参照: ${ref}`)
  }
  assert.doesNotMatch(videoComponent, /<(?:video|source)[^>]*(?:src|poster)="https?:/, '第三者 URL の動画参照がある')
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

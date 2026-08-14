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
const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

test('video は無音自動再生・ループ・インライン再生・装飾扱いで組む', () => {
  const video = page.match(/<video[\s\S]*?>/)?.[0] ?? ''
  for (const attr of ['autoPlay', 'muted', 'loop', 'playsInline', 'aria-hidden="true"', 'preload="metadata"']) {
    assert.ok(video.includes(attr), `video 要素に ${attr} が無い`)
  }
  assert.match(video, /poster="\/media\//, 'poster が /media/ 配下でない')
})

test('動画の参照はすべて自ホストの /media/ 配下（第三者 URL を機械的に禁止）', () => {
  const refs = [...page.matchAll(/(?:src|poster)="([^"]+)"/g)].map((m) => m[1])
  assert.ok(refs.length >= 2, '動画参照が見つからない')
  for (const ref of refs) {
    assert.ok(ref.startsWith('/media/'), `自ホスト外の参照: ${ref}`)
  }
  assert.doesNotMatch(page, /<(?:video|source)[^>]*(?:src|poster)="https?:/, '第三者 URL の動画参照がある')
})

test('素材ゲート: 素材が無いビルドでは video 要素を出さない', () => {
  assert.match(page, /fs\.existsSync/, 'ビルド時のファイル存在判定が無い')
  assert.match(page, /\{hasHeroVideo && \(/, '存在判定で video の出力を分けていない')
})

test('prefers-reduced-motion では自動再生せず poster に落とす（CSS のみ・JS なし)', () => {
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.hero__video \{[\s\S]*?display: none/,
    'reduced-motion で動画を止める規則が無い',
  )
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?hero-poster\.jpg/,
    'reduced-motion の poster フォールバックが無い',
  )
  assert.doesNotMatch(page, /<script/, 'ホームに script を足さない')
})

test('文字コントラスト用のオーバーレイがある', () => {
  assert.match(css, /\.hero--video::before \{[\s\S]*?linear-gradient/, '暗いオーバーレイが無い')
})

/**
 * 総当たり対策の「相手」の決め方の試験（designs 2026-08-09 23:45）。
 *
 * **ここが逆になると穴が開く**ので、単体で固める。
 * 「信じない設定ではヘッダを無視する」が本体で、残りはその周りの確認。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { clientKey } from './lib/client-ip.mjs'

/** req の最小のかたち。 */
function req(headers = {}, remoteAddress = '203.0.113.9') {
  return { headers, socket: { remoteAddress } }
}

test('信じるヘッダを渡さなければ、ヘッダが在っても socket を使う', () => {
  const r = req({ 'x-real-ip': '198.51.100.7', 'cf-connecting-ip': '198.51.100.8' })
  assert.equal(clientKey(r, null), '203.0.113.9')
  assert.equal(clientKey(r, undefined), '203.0.113.9')
  assert.equal(clientKey(r, ''), '203.0.113.9')
  assert.equal(clientKey(r, '   '), '203.0.113.9')
})

test('信じるヘッダを渡せば、そのヘッダを使う', () => {
  assert.equal(clientKey(req({ 'x-real-ip': '198.51.100.7' }), 'x-real-ip'), '198.51.100.7')
})

test('ヘッダ名の大文字小文字は問わない', () => {
  assert.equal(clientKey(req({ 'x-real-ip': '198.51.100.7' }), 'X-Real-IP'), '198.51.100.7')
})

test('信じる設定でもヘッダが無ければ socket に落ちる（鍵を空にしない）', () => {
  assert.equal(clientKey(req({}), 'x-real-ip'), '203.0.113.9')
  assert.equal(clientKey(req({ 'x-real-ip': '' }), 'x-real-ip'), '203.0.113.9')
  assert.equal(clientKey(req({ 'x-real-ip': '   ' }), 'x-real-ip'), '203.0.113.9')
})

test('カンマで連なる形は先頭を取る（X-Forwarded-For の形）', () => {
  const r = req({ 'x-forwarded-for': '198.51.100.7, 70.41.3.18, 150.172.238.178' })
  assert.equal(clientKey(r, 'x-forwarded-for'), '198.51.100.7')
})

test('同じヘッダが複数回来たら先頭を取る', () => {
  const r = req({ 'x-real-ip': ['198.51.100.7', '198.51.100.8'] })
  assert.equal(clientKey(r, 'x-real-ip'), '198.51.100.7')
})

test('socket も無ければ unknown（例外にしない）', () => {
  assert.equal(clientKey({ headers: {}, socket: {} }, null), 'unknown')
  assert.equal(clientKey({ headers: {} }, null), 'unknown')
})

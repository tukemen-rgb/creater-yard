import assert from 'node:assert/strict'
import test from 'node:test'

import { appendInterviewTranscript } from '../lib/story-interview.ts'

test('音声回答は手入力済みの回答へ追記する', () => {
  assert.equal(
    appendInterviewTranscript('ホラーゲームを作っています', '敵の動きを調整中です'),
    'ホラーゲームを作っています 敵の動きを調整中です',
  )
})

test('空の回答では余分な空白を付けない', () => {
  assert.equal(appendInterviewTranscript('', '  音声だけの回答  '), '音声だけの回答')
})

test('音声追記後も回答上限を超えない', () => {
  assert.equal(appendInterviewTranscript('あ'.repeat(1199), '追加').length, 1200)
})

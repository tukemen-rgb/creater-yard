import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('聞き取り中は質問移動と回答変更を止める', () => {
  const source = readFileSync(new URL('../components/story-interview.tsx', import.meta.url), 'utf8')
  assert.match(source, /onListeningChange=\{setVoiceListening\}/)
  assert.match(source, /disabled=\{voiceListening \|\| busy\}/)
  assert.match(source, /disabled=\{busy \|\| voiceListening\}/)
})

test('下書き準備中は復元回答のリセットを止める', () => {
  const source = readFileSync(new URL('../components/story-interview.tsx', import.meta.url), 'utf8')
  assert.match(
    source,
    /className="linklike" disabled=\{busy \|\| voiceListening\} onClick=\{restart\}/,
  )
})

test('同じ質問の進行処理を重複実行しない', () => {
  const source = readFileSync(new URL('../components/story-interview.tsx', import.meta.url), 'utf8')
  assert.match(source, /const advanceLockRef = useRef\(false\)/)
  assert.match(source, /if \(advanceLockRef\.current\) return\s+advanceLockRef\.current = true/)
  assert.match(source, /advanceLockRef\.current = false\s+}, \[step\]\)/)
})

test('固定質問のヒアリングをAI処理と誤表示しない', () => {
  const source = readFileSync(new URL('../components/story-interview.tsx', import.meta.url), 'utf8')
  assert.match(source, />Storyヒアリング</)
  assert.match(source, /CreatorYard独自のAI\/APIへ回答を送信しません/)
  assert.match(source, /ブラウザ提供者側で処理される場合があります/)
  assert.doesNotMatch(source, />AIヒアリング</)
})

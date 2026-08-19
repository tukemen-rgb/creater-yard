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

// 文言そのものが守っているもの（AI が書いたと誤解させない）なので、
// 型は文言に添わせる。2026-08-19 に日本語と Latin 語の間へ空白を入れて
// 揃えたときに赤くなった —— **意味のある赤だったので、型のほうを直した。**
test('固定質問のヒアリングを AI 処理と誤表示しない', () => {
  const source = readFileSync(new URL('../components/story-interview.tsx', import.meta.url), 'utf8')
  assert.match(source, />Story ヒアリング</)
  assert.match(source, /CreatorYard 独自の AI\/API へ回答を送信しません/)
  assert.doesNotMatch(source, />AI ?ヒアリング</)

  /**
   * **2026-08-20（U-11）に、この 1 行だけ縛り方を変えた。**
   *
   * 以前はここで「ブラウザ提供者側で処理される場合があります」という
   * **この面の文言そのもの**を縛っていた。①が数えたら、**同じ音声入力を
   * 置いている書く面には、その説明が 1 つも無かった** —— 片方の面だけが
   * 言っている状態だった。
   *
   * 直し方を「両方に書く」にすると、**片方だけ古くなる**。そこで一言を
   * `VoiceInput` に持たせ、**音声入力を置いた場所すべてに付いて回る**
   * ようにした。だからここでは、**その部品を置いていること**と、
   * **部品が持つ一言が行き先を言っていること**を見る。
   *
   * **守るものは変えていない**（読み手には同じ文が同じ画面に出る）。
   * 変えたのは、それを**どこから取るか**だけ。
   */
  assert.match(source, /<VoiceInput[\s>]/, '音声入力を置いていない（説明も一緒に消える）')
  const note = /export const VOICE_NOTE =\s*\n?\s*'([^']+)'/.exec(
    readFileSync(new URL('../components/voice-input.tsx', import.meta.url), 'utf8'),
  )
  assert.ok(note, '音声の行き先を言う一言が部品に無い')
  assert.match(note[1], /サーバー|送/, '一言が、音声の行き先を言っていない')
})

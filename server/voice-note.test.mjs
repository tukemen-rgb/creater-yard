/**
 * 音声入力の行き先を、**押す前に**言う（設計 U-11）。
 *
 * ①が 2026-08-20 に数えたところ、**ヒアリングの面だけが説明していて、
 * 書く面の同じボタン 2 つには何も書いていなかった。**同じ機能なのに
 * 片方の面でしか言っていない形（U-5・U-6 と同じ）。`/data-policy/` にも
 * 記述が無かった。
 *
 * 事実の出典は MDN の `SpeechRecognition`（事例 77）——
 * ブラウザによっては音声が提供者のサーバーへ送られる。
 * **CreatorYard は音声を受け取らない。**それでも、書き手から見れば
 * **声が外へ出るかどうか**が問題なので、押す前に言う。
 *
 * **直し方は「両方に書く」ではない。**一言を部品に持たせて、
 * **音声入力を置いた場所すべてに付いて回る**ようにした。だから試験も
 * 文言を書き写さず、**部品から取り出して**突き合わせる。
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const voice = read('components/voice-input.tsx')

/** 一言の本体。**ここが唯一の出どころ。** */
function note() {
  const m = /export const VOICE_NOTE =\s*\n?\s*'([^']+)'/.exec(voice)
  assert.ok(m, '音声の行き先を言う一言が、部品に無い')
  return m[1]
}

test('一言が、声の行き先を言っている', () => {
  const text = note()
  assert.match(text, /音声|声/, '何の話かが分からない')
  assert.match(text, /サーバー|送/, 'どこへ行くのかを言っていない')
})

test('部品が、その一言を自分で描いている', () => {
  assert.match(
    voice,
    /<span className="voice-input__note">\{VOICE_NOTE\}<\/span>/,
    '一言を持っているだけで、描いていない',
  )
})

/**
 * **置いた場所すべてに付いて回るか。**`VoiceInput` を使っている面を
 * 探して全部見る（一覧を書き写さない）。部品が描くので、面の側は
 * 何もしなくてよい —— **それを確かめる**のがこの試験の役目。
 */
function users() {
  return [
    ...globSync('app/**/*.tsx', { cwd: ROOT }),
    ...globSync('components/*.tsx', { cwd: ROOT }),
  ].filter((f) => f !== 'components/voice-input.tsx' && read(f).includes('<VoiceInput'))
}

test('音声入力を置いている面が、1 つ以上ある', () => {
  assert.notDeepEqual(users(), [], '音声入力がどこにも置かれていない')
})

// 同じことを 2 度言わない。**片方だけ古くなる**のが、この直しで消したかった形。
test('面の側は、同じ説明を自分で持たない', () => {
  const text = note()
  const key = text.includes('サーバー') ? 'サーバー' : '送'
  for (const f of users()) {
    const src = read(f)
      .split('\n')
      .filter((line) => !/^\s*(\{?\/\*|\*|\/\/)/.test(line))
      .join('\n')
    const about = src.split('\n').filter((line) => line.includes('音声') && line.includes(key))
    assert.deepEqual(
      about,
      [],
      `${f}: 面が音声の行き先を自分で書いている（部品と二重になる）`,
    )
  }
})

test('一言に CSS がある', () => {
  assert.match(read('app/globals.css'), /\.voice-input__note\s*\{/, '一言の見た目が決まっていない')
})

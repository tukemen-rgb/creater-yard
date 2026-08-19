/**
 * **読み終えた人に、書き始める道が 1 本あること**（U-14）。
 *
 * 2026-08-20 に数えたら、Story の面から `/write/` へ行く道は
 * **本人向けの「その後を書く」しか無く**、読者に差し出している最後のリンクは
 * **「この Story の問題を通報する」**だった。
 * **招かれた人が最初に開くのは、たいてい Story の直リンク**である。
 *
 * ここで縛るのは 4 つ。**どれも語や場所を書き写さない。**
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const invite = read('components/story-invite.tsx')
const nextLink = read('components/write-next-link.tsx')
const article = read('components/story-article.tsx')
const home = read('app/page.common.tsx')
const entry = read('lib/write-entry.ts')

/** 註釈は約束ではない（この repo で何度も踏んでいる罠）。 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

test('本人には出さない（本人向けの導線と同じ見分け方をしている）', () => {
  const body = withoutComments(invite)
  assert.match(body, /getHandle\(\)\s*===\s*authorHandle/, '本人かどうかを見ていない')
  assert.match(body, /return null/, '本人のときに何も出さない枝が無い')
  // **同じ見分け方**であること。片方だけ変わると、本人に 2 つ並ぶ
  assert.match(
    withoutComments(nextLink),
    /getHandle\(\)\s*===\s*authorHandle/,
    '本人向けの導線が別の見分け方をしている（2 つ並ぶ）',
  )
})

test('行き先が、トップの「書き始める」と同じ入口である', () => {
  const m = /WRITE_START_HREF = '([^']+)'/.exec(entry)
  assert.ok(m, '入口が 1 か所に置かれていない')
  // **書き写さない。**両方が同じ定数を使っていることを見る
  assert.match(withoutComments(home), /WRITE_START_HREF/, 'トップが共通の入口を使っていない')
  assert.match(withoutComments(invite), /WRITE_START_HREF/, '招待が共通の入口を使っていない')
  assert.match(m[1], /^\/write\//, '入口が書く画面を指していない')
})

test('通報より前に出る', () => {
  const body = withoutComments(article)
  const at = body.indexOf('StoryInvite')
  const report = body.indexOf('story__report')
  assert.notEqual(at, -1, 'Story の面に招待が入っていない')
  assert.notEqual(report, -1, '通報の行が見つからない（前提が崩れている）')
  assert.ok(at < report, '通報より後ろに出ている（困っている人の前に置かない）')
})

/**
 * **数を持たない。**「◯人が書いています」は公開カウンタに近づく。
 * I-11 で `write-next-link.tsx` に同じ縛りを掛けている（註釈も含めて見る）。
 */
test('数を取りに行かない・煽らない', () => {
  for (const banned of ['/api/mine', '本目', '人が書', 'かんたん', 'いまなら', '無料']) {
    assert.ok(!invite.includes(banned), `招待に「${banned}」が入っている`)
  }
})

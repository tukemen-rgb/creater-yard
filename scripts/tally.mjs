#!/usr/bin/env node
/**
 * 撤退条件（SPEC §4）を数える道具。**サイト全体の合計だけ**を出す。
 *
 *   node scripts/tally.mjs                … 合計だけ
 *   node scripts/tally.mjs 2026-09-13    … 判定日までの残り日数つき
 *
 * 出すのは「公開 Story の総数」と「書き手の人数」の 2 つだけ。
 * **ハンドルも authorId も、個人につながるものは一切出さない**
 * （個人単位の行動計測をしない、の実装上の見張り。試験が縛っている）。
 *
 * web にも API にも出さない。サーバー上で手で叩く CLI 専用
 * （公開カウンタを作らない、の線を越えないため）。
 *
 * 読み取り専用: fs の読み出しと console だけで書く。書き込み API も
 * ネットワーク API も import しない（これも試験がソースを検査する）。
 *
 * 判定日を引数にしているのは、「公開から 30 日」の起点（公開日か・
 * 招待開始日か・noindex 解除日か）が社長の判断でまだ決まっていないため。
 * 決定をコードに焼き込まない。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = process.env.CY_DATA_DIR ?? path.join(ROOT, 'server', 'store')
const STORIES_DIR = path.join(DATA_DIR, 'stories')

const GOAL = { writers: 10, stories: 30 } // SPEC §4 の数字。変えるのは人

const judgeArg = process.argv[2]
let judgeDate = null
if (judgeArg !== undefined) {
  // 判定日は YYYY-MM-DD だけを受ける。緩く解釈しない（1 日ずれると判定がずれる）
  if (!/^\d{4}-\d{2}-\d{2}$/.test(judgeArg) || Number.isNaN(Date.parse(`${judgeArg}T00:00:00Z`))) {
    console.error('使い方: node scripts/tally.mjs [判定日 YYYY-MM-DD]')
    process.exit(2)
  }
  judgeDate = new Date(`${judgeArg}T00:00:00Z`)
}

let publicCount = 0
const writerIds = new Set() // 数えるためだけに持ち、出力には出さない
let unreadable = 0

let entries = []
try {
  entries = fs.readdirSync(STORIES_DIR).filter((name) => name.endsWith('.json'))
} catch {
  // store がまだ無い＝ 0 件。落とさない（clone 直後でも使える）
}

for (const name of entries) {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(STORIES_DIR, name), 'utf8'))
    if (record?.status !== 'public') continue
    publicCount += 1
    if (record.authorId) writerIds.add(record.authorId)
  } catch {
    // 1 件読めなくても数え続ける。ただし黙らない（最後に件数を出す）
    unreadable += 1
  }
}

const today = new Date()
const stamp = today.toISOString().slice(0, 10)
console.log(`${stamp}: 公開 Story ${publicCount} 本 / 書き手 ${writerIds.size} 人`)

if (judgeDate) {
  const days = Math.ceil((judgeDate.getTime() - today.getTime()) / 86_400_000)
  const clock = days >= 0 ? `残り ${days} 日` : `超過 ${-days} 日`
  console.log(`（判定日 ${judgeArg} まで${clock}。目標: 書き手 ${GOAL.writers} 人・Story ${GOAL.stories} 本）`)
}

if (unreadable > 0) {
  console.log(`読めなかった記録: ${unreadable} 件（数に入っていない）`)
}

/**
 * **端末に残るものの一覧が、実装と一致していること。**
 *
 * `/data-policy/` は自分の註釈でこう決めている:
 *
 * > ここに書いたことは実装の事実と一致させる（**書くだけの約束にしない**）
 *
 * ところが 2026-08-20 に数えたら、**端末に残るものを 1 つも書いていなかった**
 * （実際には 5 つある）。書いただけでは同じことがまた起きるので、
 * **機械で突き合わせる。**
 *
 * **鍵を書き写さない。**製品コードから拾った鍵の集合と、一覧の集合を比べる。
 * 片方にしか無い鍵があれば赤くなる。
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const table = read('lib/device-storage.ts')
const page = read('app/data-policy/page.common.tsx')

/** 註釈は約束ではない（`scripts/audit-copied-literals.mjs` と同じ扱い）。 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

/**
 * **実装が実際に端末へ置いている鍵。**
 *
 * `localStorage` に渡している名前は、この repo では定数に入っている
 * （`const TOKEN_KEY = 'cy-token'` の形）。**その定数の値を拾う。**
 * 一覧そのもの（`lib/device-storage.ts`）は対象から外す —— 自分を数えると
 * 「一覧に在るから正しい」になって、何も守らない。
 */
function keysUsedByCode() {
  const found = new Set()
  const files = ['app/**/*.tsx', 'app/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts']
    .flatMap((g) => globSync(g, { cwd: ROOT }))
    .filter((f) => f !== 'lib/device-storage.ts')
  for (const rel of files) {
    const source = withoutComments(read(rel))
    if (!/localStorage/.test(source)) continue
    for (const m of source.matchAll(/'((?:cy-|creatoryard:)[A-Za-z0-9:_-]+)'/g)) found.add(m[1])
  }
  return [...found].sort()
}

/** 一覧が挙げている鍵。 */
function keysInTable() {
  return [...withoutComments(table).matchAll(/key: '([^']+)'/g)].map((m) => m[1]).sort()
}

test('端末に置く鍵が、一覧と過不足なく一致する', () => {
  const used = keysUsedByCode()
  const listed = keysInTable()
  assert.ok(used.length > 0, '端末に置く鍵が 1 つも見つからない（試験の前提が崩れている）')
  assert.deepEqual(
    listed,
    used,
    `一覧と実装がずれている（一覧: ${listed.join(' ')} ／ 実装: ${used.join(' ')}）`,
  )
})

test('画面は一覧から描いている（文言を直書きしていない）', () => {
  assert.match(page, /DEVICE_STORAGE\b/, '画面が一覧を参照していない')
  for (const key of keysInTable()) {
    assert.ok(
      !page.includes(`'${key}'`) && !page.includes(`>${key}<`),
      `画面に鍵「${key}」を直書きしている（一覧から描くこと）`,
    )
  }
})

/**
 * **ブラウザが勝手に消すことを、画面が言っていること。**
 *
 * 「自分で外したとき」だけを書くと、**7 日で消えることを知らない人は
 * 「消えないもの」と読む**（事例 83・MDN）。
 */
test('ブラウザが消すことを、画面が言っている', () => {
  assert.match(table, /7 日/, '一覧が 7 日の話を持っていない')
  assert.match(table, /Safari/, 'どのブラウザの話かを言っていない')
  assert.match(page, /DEVICE_STORAGE_EVICTION\b/, '画面がその文を出していない')
})

/** 上限は `lib/saved-stories.ts` から取る（数を書き写さない）。 */
test('「あとで読む」の本数を、一覧が書き写していない', () => {
  assert.match(table, /MAX_SAVED_STORIES/, '上限を数で書き写している')
})

#!/usr/bin/env node
/**
 * server/ の試験をまとめて走らせる（O-5。設計 2026-08-17 10:30）。
 *
 * これまで `package.json` の `test:server` に試験ファイルを 1 本ずつ手で
 * 並べていた。**足し忘れると、書いた試験が一度も走らないまま緑に見える。**
 * 2026-08-18 に `server/report-health.test.mjs` が実際にその状態で、
 * **11 件がまるごと走っていなかった**（`2c04c28`）。人の注意で守る形を
 * やめ、拾う側に寄せる。
 *
 * **ただし glob には、もっと危ない性質がある。**
 *
 *     $ node --test "nosuch/*test.mjs"
 *     # tests 0
 *     終了コード: 0        ← **1 件も無くても緑**
 *
 * 型を 1 文字打ち間違えただけで「全部通った」に見える。**鳴らない警報**で、
 * O-1（バックアップが黙って止まる）と同じ穴を試験の入口に作ることになる。
 * **だから 0 件を赤で止める床を、glob と同じ場所に置く。**
 *
 * やることは 3 つだけ:
 *   1. `server/*test.mjs` を拾う（`fs.globSync` は Node 22 の標準。依存を増やさない）
 *   2. **0 件なら走らせずに赤で止める**
 *   3. 拾った一覧を画面に出してから `node --test` に渡す（黙って飛ばさない）
 *
 * 型は **`server/` 直下**に限る。再帰しないので `server/lib/`（実装）も
 * `server/store/`（実データ）も拾わない。
 *
 * 環境変数 `CY_TEST_GLOB` で型を差し替えられる（**試験のためだけにある**。
 * 通常の実行では触らない）。`--list-only` は拾った一覧を出して終わる。
 */
import { spawnSync } from 'node:child_process'
import { globSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PATTERN = process.env.CY_TEST_GLOB ?? 'server/*test.mjs'
const listOnly = process.argv.includes('--list-only')

const files = globSync(PATTERN, { cwd: ROOT }).sort()

if (files.length === 0) {
  // ここが床。`node --test` は 0 件でも終了コード 0 を返すので、
  // 渡す前に止める。型の打ち間違いを「全部通った」に見せない。
  console.error(`試験が 1 件も見つかりません（型: ${PATTERN}）。`)
  console.error('型の打ち間違いか、置き場所が変わっています。走らせずに止めます。')
  process.exit(1)
}

console.log(`server の試験を ${files.length} 本 走らせます（型: ${PATTERN}）:`)
for (const f of files) console.log(`  ${f}`)

if (listOnly) process.exit(0)

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: ROOT,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)

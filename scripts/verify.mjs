#!/usr/bin/env node
/**
 * 公開手前まで一発で確かめる。GAMEYARD の release.mjs の考え方の縮約。
 *
 *   lint → サーバー試験 → 静的ビルド → 出力検証 → server ビルド → 出力検証
 *
 * 出力検証を入れているのは、ビルドが「緑で終わった」ことと「正しい成果物が
 * できた」ことが別だから。実際にあった事故: 別モードの dev サーバーが生きて
 * いて、本番用 .next にデベロップモードの成果物を上書きし、/stories/ が
 * クライアント版のまま配信された（SSR に本文が入らない＝タグ SEO が死ぬ）。
 * ここでは最後に .next のルート表を見て、server モードのルートが**実際に**
 * 載っていることを確かめる。
 *
 *   node scripts/verify.mjs
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const results = []

function run(label, command, env = {}) {
  process.stdout.write(`\n=== ${label}: ${command}\n`)
  execSync(command, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } })
  results.push(label)
}

function check(label, fn) {
  const problem = fn()
  if (problem) {
    console.error(`\n[verify] NG: ${label} — ${problem}`)
    process.exit(1)
  }
  results.push(label)
}

run('lint', 'npm run lint')
run('サーバー試験', 'npm run test:server')

// ---- 静的ビルド ----
// 前回の verify や手動 build:server の成果物が残っていると、server 専用の
// 動的ルートが静的 export に混ざる。どの順番で実行しても同じ結果になるよう、
// 静的ビルドの前にも .next を空にする。
fs.rmSync(path.join(ROOT, '.next'), { recursive: true, force: true })
run('静的ビルド', 'npm run build')
check('静的出力', () => {
  const out = path.join(ROOT, 'out')
  for (const page of ['index.html', 'login/index.html', 'signup/index.html', 'write/index.html', 'robots.txt']) {
    if (!fs.existsSync(path.join(out, page))) return `out/${page} がありません`
  }
  // 静的モードに server 専用ルートが混ざっていたら pageExtensions が壊れている
  if (fs.existsSync(path.join(out, 'story'))) {
    const entries = fs.readdirSync(path.join(out, 'story'))
    if (entries.some((e) => e !== 'index.html' && e !== 'index.txt')) {
      return 'out/story/ に動的ルートの出力が混ざっています'
    }
  }
  return null
})

// ---- server ビルド ----
// .next を消してから。前のビルド（や dev サーバー）の残骸と混ざるのを防ぐ
fs.rmSync(path.join(ROOT, '.next'), { recursive: true, force: true })
run('server ビルド', 'npm run build:server')
check('server 出力', () => {
  const manifest = path.join(ROOT, '.next', 'server', 'app-paths-manifest.json')
  if (!fs.existsSync(manifest)) return 'app-paths-manifest.json がありません'
  const routes = Object.keys(JSON.parse(fs.readFileSync(manifest, 'utf8')))
  for (const route of ['/story/[id]/page', '/creators/[handle]/page', '/stories/page', '/tags/page']) {
    if (!routes.includes(route)) return `server モードのルート ${route} が載っていません`
  }
  // /stories が static 版（クライアント fetch）で入っていないか。
  // server 版にはローディング表示が無いことを目印にする
  const storiesJs = fs.readFileSync(path.join(ROOT, '.next', 'server', 'app', 'stories', 'page.js'), 'utf8')
  if (storiesJs.includes('読み込み中')) {
    return '/stories が static 版のまま server ビルドに入っています（.next の混入）'
  }
  return null
})

console.log(`\n[verify] すべて緑（${results.length} 段階）: ${results.join(' → ')}`)
console.log('[verify] .next は server モードの成果物になっています（そのまま start:server できる）')

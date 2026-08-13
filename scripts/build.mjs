#!/usr/bin/env node
/**
 * static/server の Next.js build を必ずクリーンな成果物から始める。
 *
 * 両モードは pageExtensions と distDir を切り替える。各モードの
 * 成果物を物理的に分け、server 専用の動的ルートが static export に
 * 混ざる余地をなくす。外部の SITE_MODE も要求した値へ上書きする。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mode = process.argv[2]

if (mode !== 'static' && mode !== 'server') {
  console.error('usage: node scripts/build.mjs <static|server>')
  process.exit(2)
}

const distDir = mode === 'server' ? '.next-server' : '.next'
fs.rmSync(path.join(ROOT, distDir), { recursive: true, force: true })
if (mode === 'static') {
  fs.rmSync(path.join(ROOT, 'out'), { recursive: true, force: true })
}

const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const status = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [nextBin, 'build'], {
    cwd: ROOT,
    env: { ...process.env, SITE_MODE: mode },
    stdio: 'inherit',
  })
  child.once('error', reject)
  child.once('exit', (code) => resolve(code ?? 1))
})

process.exit(status)

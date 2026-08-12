#!/usr/bin/env node
/**
 * static/server の Next.js build を必ずクリーンな成果物から始める。
 *
 * 両モードは pageExtensions を切り替える一方、Next.js の内部成果物 `.next`
 * を共有する。直前の別モードが残ると server 専用の動的ルートが static export
 * に混ざるため、npm script の入口で削除し、外部の SITE_MODE も上書きする。
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

fs.rmSync(path.join(ROOT, '.next'), { recursive: true, force: true })
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

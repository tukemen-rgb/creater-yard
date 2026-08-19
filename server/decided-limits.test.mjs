/**
 * **決めた上限を、緩めたら赤くする**（T-2）。
 *
 * 2026-08-20 に測ったら、`MAX_BODY_BYTES` を **10 倍にしても試験が 1 件も
 * 赤くならなかった**。CLAUDE.md の「人が決めるまで変えない一覧」に
 * **上限の緩和**が入っているのに、である。
 *
 * **既存の網は「ずれ」を見ている**（画面とサーバーが違う値を言っていないか）。
 * **両方を揃えて緩めれば通る。**だから**決めた値を 1 回だけ**
 * `docs/decided-limits.md` に書き、**決定と実装**を突き合わせる。
 *
 * **これは「数を書き写さない」原則とぶつからない。**
 * あの原則が禁じているのは**実装どうしの複製**で、
 * ここで比べるのは**決定と実装**である（原本は複製ではない）。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const record = read('docs/decided-limits.md')

/** 原本の表（`| 名前 | 値 | 実装の場所 | … |`）を読む。 */
function decided() {
  const rows = []
  for (const line of record.split('\n')) {
    const m = /^\|\s*`([A-Za-z_][A-Za-z0-9_]*)`\s*\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|/.exec(line)
    if (m) rows.push({ name: m[1], value: Number(m[2]), file: m[3] })
  }
  return rows
}

/**
 * 実装側の値。`NAME = 64 * 1024` と `name: 20,` の両方を読む。
 * **掛け算だけ解く。**関数呼び出しや変数は解かない（解けたら見落とすため）。
 */
function implemented(name, file) {
  const source = read(file)
  const m =
    new RegExp(String.raw`\b${name}\s*=\s*([0-9*\s]+?)\s*$`, 'm').exec(source) ??
    new RegExp(String.raw`\b${name}\s*:\s*([0-9*\s]+?)\s*,`, 'm').exec(source)
  assert.ok(m, `${file} に ${name} の値が見つからない`)
  const parts = m[1].split('*').map((p) => Number(p.trim()))
  assert.ok(
    parts.every((n) => Number.isFinite(n)),
    `${file} の ${name} が数の掛け算になっていない: ${m[1]}`,
  )
  return parts.reduce((a, b) => a * b, 1)
}

test('原本の上限が、実装と一致する', () => {
  const rows = decided()
  assert.ok(rows.length >= 5, `原本の行が少なすぎる（${rows.length} 行）`)
  for (const row of rows) {
    assert.equal(
      implemented(row.name, row.file),
      row.value,
      `${row.name} が原本（${row.value}）と実装（${row.file}）で違う。` +
        '緩めるなら、先に docs/decided-limits.md を直すこと',
    )
  }
})

/**
 * **新しい枠が、原本を通らずに増えていないか。**
 * 上限は増えることがあるので、ここだけ**分母を数える**。
 */
test('流量の枠が、原本に載っていないまま増えていない', () => {
  const gate = read('server/lib/gate.mjs')
  const burstNames = [...gate.matchAll(/^\s*(perIp[A-Za-z]*Burst)\s*:/gm)].map((m) => m[1])
  const listed = new Set(decided().map((r) => r.name))
  for (const name of burstNames) {
    assert.ok(listed.has(name), `${name} が原本に載っていない（増えた枠は表に足すこと）`)
  }
})

/** API を 1 つ立てて、終わったら必ず落とす（港の範囲は他の試験と重ねない）。 */
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
async function withApi(body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-limit-'))
  let child = null
  let base = ''
  try {
    for (let port = 8990; port < 9010 && !base; port += 1) {
      const candidate = spawn(process.execPath, ['server/api.mjs'], {
        cwd: ROOT,
        env: { ...process.env, CY_DATA_DIR: dir, CY_API_PORT: String(port) },
        stdio: 'ignore',
      })
      for (let tries = 0; tries < 40; tries += 1) {
        if (candidate.exitCode !== null) break
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/health`)
          // 答えたのが**自分の子**であることまで見る（先客だと落ちている）
          if (res.ok && candidate.exitCode === null) {
            child = candidate
            base = `http://127.0.0.1:${port}`
            break
          }
        } catch {
          // まだ起きていない
        }
        await wait(50)
      }
      if (!base) candidate.kill('SIGKILL')
    }
    assert.ok(base, 'API を立てられなかった')
    return await body(base)
  } finally {
    child?.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * **ここが本題。**表と実装が揃っていても、**効いていなければ意味が無い。**
 * 本物の API に上限を超える本文を投げて、**413 が返る**ことを見る。
 * **数は試験に書かない** —— 原本から読んだ値を使う。
 */
test('【実行】本文の上限が、実際に効いている（413）', () =>
  withApi(async (base) => {
    const row = decided().find((r) => r.name === 'MAX_BODY_BYTES')
    assert.ok(row, '原本に MAX_BODY_BYTES が無い')
    const oversized = JSON.stringify({ handle: 'aki_dev', password: 'x'.repeat(row.value) })
    assert.ok(oversized.length > row.value, '試験の入力が上限を超えていない')
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: oversized,
    }).catch(() => null)
    // 上限を超えた時点で接続を切る作りなので、応答が返らないこともある。
    // **返ってきたなら 413 でなければならない。**
    if (res) {
      assert.equal(res.status, 413, `上限を超えた本文が ${res.status} で通っている`)
    }
  }))

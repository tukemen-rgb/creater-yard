/**
 * **HEAD は「本文の無い GET」である。**
 *
 * **2026-08-20 に本番（creatoryard.io）を歩いて見つけた壊れ。**
 * この API が出す経路は、GET なら 200 を返すのに **HEAD だと 404** を
 * 返していた:
 *
 *   HEAD 404 / GET 200   /api/health
 *   HEAD 404 / GET 200   /api/feeds/stories.xml
 *   HEAD 404 / GET 200   /sitemap-stories.xml
 *   HEAD 200 / GET 200   /（Next が出す面は正しかった）
 *
 * 外から確かめる道具 —— RSS の検査、リンク切れ調べ、死活監視 —— は
 * HEAD で叩く。**「配信が死んでいる」と外の道具に報告される形**であり、
 * 検索に出す判断（noindex を外すか）より前に直しておくものである。
 *
 * **もう 1 つ、目に見えない側も直っている。**読み書きの上限を分ける判定が
 * GET だけを読みと見なしていたため、**HEAD は書き込みの枠を減らしていた。**
 * 書き込みの枠（20）は読みの枠（60）より厳しいので、HEAD を続けて投げると
 * **その接続元の書き込みだけが先に止まる。**下の 4 つ目の試験がそこを見る。
 *
 * **上限そのものは緩めていない**（振り分けを直しただけ）。この試験が出す
 * 書き込みは 2 回、読み出しは 25 回で、どちらも既定の枠に収まる。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * API を 1 つ立てて、終わったら必ず落とす。港は空いているものを探す
 * （決め打ちにすると、前の周の残りを測ってしまう）。
 *
 * `CY_SITE_ORIGIN` を渡すのは、sitemap が**未設定だと GET でも 404** に
 * なるからである。設定しないまま「HEAD も GET も 404 で一致」と書くと、
 * **壊れたまま緑になる**。
 *
 * **港の範囲は他の試験と重ねない。**最初 8910〜8930 で書いたら
 * `api-ownership.test.mjs` と同じ範囲で、通しで走らせたとき**あちらが
 * 2 件落ちた**。同時に走ると、後から来たほうの `spawn` が港を取れず、
 * それでも**先客の健康確認に成功して、他人のサーバーを測ってしまう**。
 * 範囲を分けたうえで、**自分の子が生きていることも確かめる**。
 */
async function withApi(body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-head-'))
  let child = null
  let base = ''
  try {
    for (let port = 8950; port < 8970 && !base; port += 1) {
      const candidate = spawn(process.execPath, ['server/api.mjs'], {
        cwd: ROOT,
        env: {
          ...process.env,
          CY_DATA_DIR: dir,
          CY_API_PORT: String(port),
          CY_SITE_ORIGIN: 'https://example.test',
        },
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

const HANDLE = 'aki_dev'

/** 書き手 1 人と公開 Story 1 本（書き込み 2 回）。 */
async function seed(base) {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: HANDLE, password: 'demo-passphrase-2026' }),
  })
  const account = await res.json()
  assert.ok(res.ok, `登録できない: ${res.status} ${JSON.stringify(account)}`)
  const made = await fetch(`${base}/api/stories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${account.token}` },
    body: JSON.stringify({
      title: '公開の記録',
      body: '確認のための本文です。十文字を超えます。',
      status: 'public',
    }),
  })
  const story = await made.json()
  assert.ok(made.ok, `投稿できない: ${made.status} ${JSON.stringify(story)}`)
  return { token: account.token, id: story.story.id }
}

test('外から読める経路は、HEAD でも GET と同じ答えを返す', () =>
  withApi(async (base) => {
    const { id } = await seed(base)
    const paths = [
      '/api/health',
      '/api/stories.json',
      `/api/stories/${id}.json`,
      '/api/tags.json',
      `/api/creators/${HANDLE}.json`,
      '/api/feeds/stories.xml',
      `/api/feeds/creators/${HANDLE}.xml`,
      '/sitemap-stories.xml',
    ]
    for (const p of paths) {
      const got = await fetch(base + p)
      const head = await fetch(base + p, { method: 'HEAD' })
      assert.equal(got.status, 200, `GET ${p} が 200 でない（試験の前提が崩れている）`)
      assert.equal(head.status, got.status, `HEAD ${p} → ${head.status} / GET → ${got.status}`)
      assert.equal(
        head.headers.get('content-type'),
        got.headers.get('content-type'),
        `HEAD ${p} の content-type が GET と違う`,
      )
      assert.equal(await head.text(), '', `HEAD ${p} が本文を返している`)
    }
  }))

// HEAD を GET に読み替えるとき、**書き込みの経路まで開けてはならない。**
test('HEAD は書き込みの経路には回らない（何も作らない）', () =>
  withApi(async (base) => {
    await seed(base)
    const before = await (await fetch(`${base}/api/stories.json`)).json()
    // **`/api/reports` はここに入れない** —— POST（通報）と GET（運営の一覧）の
    // 両方がある経路で、HEAD は GET の側に当たるのが正しい。試験を書いた
    // ときに書き込み専用だと思い込んで 404 を期待し、401 で落ちて気づいた。
    for (const p of ['/api/stories', '/api/auth/register', '/api/story-image']) {
      const head = await fetch(base + p, { method: 'HEAD' })
      assert.equal(head.status, 404, `HEAD ${p} → ${head.status}（書き込みの経路に当たっている）`)
    }
    const after = await (await fetch(`${base}/api/stories.json`)).json()
    assert.equal(after.total, before.total, 'HEAD のあとで記録の数が変わっている')
  }))

// 認証の要る読み出しは、HEAD でも同じだけ閉じていること。
test('本人だけの経路は、HEAD でも閉じている', () =>
  withApi(async (base) => {
    await seed(base)
    // `/api/reports` の GET は運営だけ（存在も明かさない）。HEAD で回り込めない。
    for (const p of ['/api/mine', '/api/reports']) {
      const got = await fetch(base + p)
      const head = await fetch(base + p, { method: 'HEAD' })
      assert.ok(got.status >= 400, `GET ${p} が名乗り無しで ${got.status}（前提が崩れている）`)
      assert.equal(head.status, got.status, `HEAD ${p} → ${head.status} / GET → ${got.status}`)
    }
  }))

/**
 * **枠の振り分け。**書き込みの枠は 20（`GATE_DEFAULTS.perIpWriteBurst`）、
 * 読みの枠は 60。HEAD を 25 回投げてから書き込めるなら、HEAD は読みの枠を
 * 使っている。直す前はここで 429 になった（HEAD 自体が 21 回目で止まる）。
 *
 * 数は `lib/gate.mjs` から取る —— 書き写すと、上限を変えたときに
 * この試験だけ古い数のまま緑になる。
 */
test('HEAD は読みの枠を使う（書き込みの枠を減らさない）', () =>
  withApi(async (base) => {
    const { GATE_DEFAULTS } = await import('./lib/gate.mjs')
    const shots = GATE_DEFAULTS.perIpWriteBurst + 5
    assert.ok(shots < GATE_DEFAULTS.perIpReadBurst, '試験の回数が読みの枠を超えている')
    for (let i = 0; i < shots; i += 1) {
      const head = await fetch(`${base}/api/health`, { method: 'HEAD' })
      assert.equal(head.status, 200, `${i + 1} 回目の HEAD が ${head.status}`)
    }
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'bito_maker', password: 'demo-passphrase-2026' }),
    })
    assert.notEqual(res.status, 429, `HEAD ${shots} 回のあと、書き込みが止まっている`)
    assert.ok(res.ok, `登録が ${res.status} で失敗した`)
  }))

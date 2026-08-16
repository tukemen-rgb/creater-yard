/**
 * deploy/verify-public-assets.sh の検査。
 *
 * ソースの文字列検査ではなく、**本物のスクリプトを、本物の HTTP 応答に対して**
 * 走らせる。比べているのは公開側の content-length なので、試験用の小さな
 * サーバーを立てれば、そのまま同じ道を通せる。
 *
 * この試験が守るもの: 「配られているものが、置いたものと同じか」を本当に
 * 見分けられるか。2026-08-16 に、配備の確認が全部緑のまま「動画だけ古い」を
 * 通した（公開 CSP と公開 HTML しか見ていなかった）ことへの手当て。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SCRIPT = new URL('../deploy/verify-public-assets.sh', import.meta.url).pathname

/** 与えた {名前: 中身} を /media/<名前> で配る、使い捨てのサーバー。 */
async function withServer(files, fn) {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.replace(/^\/media\//, ''))
    const body = files[name]
    if (body === undefined) {
      res.writeHead(404)
      return res.end()
    }
    res.writeHead(200, { 'content-length': Buffer.byteLength(body) })
    res.end(req.method === 'HEAD' ? undefined : body)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    return await fn(origin)
  } finally {
    await new Promise((r) => server.close(r))
  }
}

async function withMediaDir(files, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-media-'))
  try {
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(path.join(dir, name), body)
    }
    return await fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// **同期の spawn は使えない。**この試験は同じプロセスの中で HTTP サーバーを
// 立てているので、同期で待つと event loop が止まり、サーバーが応答できない
// （curl が待ち続けて試験ごと固まる。最初にこれを踏んだ）。
const run = (origin, dir) =>
  new Promise((resolve) => {
    const p = spawn('bash', [SCRIPT], {
      env: { ...process.env, ORIGIN: origin, MEDIA_DIR: dir, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' },
    })
    let stdout = ''
    let stderr = ''
    p.stdout.on('data', (c) => (stdout += c))
    p.stderr.on('data', (c) => (stderr += c))
    p.on('close', (status) => resolve({ status, stdout, stderr }))
  })

test('公開されているものと手元が同じなら OK（終了コード 0）', async () => {
  const files = { 'hero.mp4': 'aaaa', 'hero-poster.jpg': 'bb' }
  await withServer(files, (origin) =>
    withMediaDir(files, async (dir) => {
      const r = await run(origin, dir)
      assert.equal(r.status, 0, r.stdout + r.stderr)
      assert.match(r.stdout, /公開素材  : OK（2 件が手元と一致）/)
    }),
  )
})

test('公開されているものが古ければ、名前と両方の大きさを出す（終了コード 2）', async () => {
  await withServer({ 'hero.mp4': 'old' }, (origin) =>
    withMediaDir({ 'hero.mp4': 'new-and-longer' }, async (dir) => {
      const r = await run(origin, dir)
      // 1 ではなく 2。配備の失敗と混同させないため
      assert.equal(r.status, 2, r.stdout + r.stderr)
      assert.match(r.stdout, /未反映 hero\.mp4（公開 3 \/ 手元 14）/)
      assert.match(r.stdout, /配備そのものは成功しています/)
    }),
  )
})

test('公開側に無いものも「未反映」として出す（黙って見逃さない）', async () => {
  await withServer({}, (origin) =>
    withMediaDir({ 'hero.webm': 'xyz' }, async (dir) => {
      const r = await run(origin, dir)
      assert.equal(r.status, 2)
      assert.match(r.stdout, /未反映 hero\.webm（公開 取得できず \/ 手元 3）/)
    }),
  )
})

test('CREDITS.md と RIGHTS_APPROVED は配布物ではないので数えない', async () => {
  // 公開側にはこの 2 つを置かない。数えていれば「未反映」で落ちる
  await withServer({ 'hero.mp4': 'aaaa' }, (origin) =>
    withMediaDir(
      { 'hero.mp4': 'aaaa', 'CREDITS.md': '# credits', RIGHTS_APPROVED: 'ok' },
      async (dir) => {
        const r = await run(origin, dir)
        assert.equal(r.status, 0, r.stdout + r.stderr)
        assert.match(r.stdout, /OK（1 件が手元と一致）/)
      },
    ),
  )
})

test('置き場が無ければ黙って飛ばす（素材を持たない構成を壊さない）', async () => {
  await withServer({}, async (origin) => {
    const r = await run(origin, '/nonexistent-creatoryard-media')
    assert.equal(r.status, 0)
    assert.match(r.stdout, /確認しません/)
  })
})

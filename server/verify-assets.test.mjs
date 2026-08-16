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

/**
 * 与えた {名前: 中身} を /media/<名前> で配る、使い捨てのサーバー。
 *
 * 値が文字列なら content-length を付けた素直な応答。
 * 値が {headers} なら、そのヘッダーをそのまま返す（content-length を
 * 返さない相手・圧縮している相手・ETag だけを返す相手を作るため）。
 */
async function withServer(files, fn) {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.replace(/^\/media\//, ''))
    const entry = files[name]
    if (entry === undefined) {
      res.writeHead(404)
      return res.end()
    }
    if (typeof entry === 'object') {
      res.writeHead(200, entry.headers)
      return res.end(req.method === 'HEAD' ? undefined : (entry.body ?? ''))
    }
    res.writeHead(200, { 'content-length': Buffer.byteLength(entry) })
    res.end(req.method === 'HEAD' ? undefined : entry)
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
      writeFileSync(path.join(dir, name), typeof body === 'object' ? (body.local ?? '') : body)
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
      assert.match(r.stdout, /公開素材  : OK（全 2 件のうち 2 件が手元と一致）/)
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

// 3 状態にしたとき、この試験が分岐の落としを教えてくれた。
// **404 は「分からない」ではなく「配られていない」。**長さが読めないからと
// いって「比べられない」に流すと、公開されていない事故を見逃す。
test('公開側に無いものは「未反映」（比べられない、ではない）', async () => {
  await withServer({}, (origin) =>
    withMediaDir({ 'hero.webm': 'xyz' }, async (dir) => {
      const r = await run(origin, dir)
      assert.equal(r.status, 2, r.stdout + r.stderr)
      assert.match(r.stdout, /未反映 hero\.webm（公開されていません: HTTP 404）/)
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
        assert.match(r.stdout, /OK（全 1 件のうち 1 件が手元と一致）/)
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

// ---- 設計 O-3: 3 状態にしたぶんの試験 ----
// ④ 03:10 が #21 に見つけた穴の手当て。content-length は RFC 9110 で MAY 
// なので、「ある前提」で組むと、応答が正常でも「未反映」と言ってしまう。

const hexEtag = (size) => `"6a81d337-${size.toString(16)}"`

test('本体: 長さはあるが圧縮後の長さなら、一致とも不一致とも言わない', async () => {
  // 手元 14 バイト。公開側は「圧縮して 3 バイトになった」と言っている。
  // ここで 3 と 14 を比べて「未反映」と言うのが、直したかった間違い。
  await withServer(
    { 'hero.svg': { headers: { 'content-length': '3', 'content-encoding': 'gzip' } } },
    (origin) =>
      withMediaDir({ 'hero.svg': { local: 'new-and-longer' } }, async (dir) => {
        const r = await run(origin, dir)
        assert.equal(r.status, 0, r.stdout + r.stderr)
        assert.match(r.stdout, /比べられません hero\.svg/)
      }),
  )
})

test('長さを返さなくても、ETag が読めれば比べられる（一致）', async () => {
  await withServer(
    { 'hero.mp4': { headers: { etag: hexEtag(4), 'transfer-encoding': 'chunked' } } },
    (origin) =>
      withMediaDir({ 'hero.mp4': { local: 'aaaa' } }, async (dir) => {
        const r = await run(origin, dir)
        assert.equal(r.status, 0, r.stdout + r.stderr)
        assert.match(r.stdout, /OK（全 1 件のうち 1 件が手元と一致）/)
      }),
  )
})

test('長さを返さず、ETag の後半が違えば不一致', async () => {
  await withServer(
    { 'hero.mp4': { headers: { etag: `W/${hexEtag(99)}` } } },
    (origin) =>
      withMediaDir({ 'hero.mp4': { local: 'aaaa' } }, async (dir) => {
        const r = await run(origin, dir)
        assert.equal(r.status, 2, r.stdout + r.stderr)
        assert.match(r.stdout, /未反映 hero\.mp4（公開 99 \/ 手元 4）/)
      }),
  )
})

test('長さも読める形の ETag も無ければ「比べられません」（0 で返す・だが黙らない）', async () => {
  await withServer({ 'hero.mp4': { headers: { etag: '"opaque-value-xyz"' } } }, (origin) =>
    withMediaDir({ 'hero.mp4': { local: 'aaaa' } }, async (dir) => {
      const r = await run(origin, dir)
      assert.equal(r.status, 0, r.stdout + r.stderr)
      assert.match(r.stdout, /比べられません hero\.mp4（長さも ETag も読めません）/)
    }),
  )
})

// ④ 05:10 の指摘 1。まとめの行が「OK」で終わり、比べられなかったものを
// 数えていなかった。**「OK」と書けるのは分母と分子が一致しているときだけ**
// （規則 20 の条項・⑤ 2026-08-17 の裁定 2）。
test('分母: 比べられないものがあるとき、まとめの行に「OK」と書かない', async () => {
  await withServer(
    { 'ok.mp4': 'aaaa', 'weird.svg': { headers: { etag: '"opaque"' } } },
    (origin) =>
      withMediaDir({ 'ok.mp4': 'aaaa', 'weird.svg': { local: 'aaaa' } }, async (dir) => {
        const r = await run(origin, dir)
        assert.equal(r.status, 0, r.stdout + r.stderr)
        assert.ok(!/OK（/.test(r.stdout), `まとめの行に「OK」が出ている:\n${r.stdout}`)
        assert.match(r.stdout, /全 2 件のうち 一致 1 \/ 比べられない 1（不一致は 0）/)
      }),
  )
})

test('分母: 不一致があるときも、まとめの行に 3 つとも出す', async () => {
  await withServer(
    { 'old.mp4': 'old', 'weird.svg': { headers: { etag: '"opaque"' } }, 'ok.mp4': 'aaaa' },
    (origin) =>
      withMediaDir(
        { 'old.mp4': 'new-and-longer', 'weird.svg': { local: 'x' }, 'ok.mp4': 'aaaa' },
        async (dir) => {
          const r = await run(origin, dir)
          assert.equal(r.status, 2, r.stdout + r.stderr)
          assert.match(r.stdout, /全 3 件のうち 一致 1 \/ 不一致 1 \/ 比べられない 1/)
        },
      ),
  )
})

/**
 * 「本番が main のどこに居るか」の検査（設計 O-6）。
 *
 * ソースの文字列検査ではなく、**本物の healthcheck.sh を、本物の HTTP 応答と
 * 本物の git 作業ツリーに対して**走らせる（server/verify-assets.test.mjs と
 * 同じ形）。文字列だけを見ると「NG と表示した」で満足してしまい、
 * **終了コードが変わったか**を取りこぼす。O-5 で踏んだ「鳴らない警報」と
 * 同じ穴なので、この試験は必ず status も見る。
 *
 * この試験が守るもの: 2026-08-19 に④が見つけた形 —— 本番が main から
 * 3 日ぶん遅れているのに、死活確認は 3 日間ずっと緑だった。
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SCRIPT = new URL('../deploy/healthcheck.sh', import.meta.url).pathname
const ROOT = new URL('..', import.meta.url).pathname

/**
 * 死活確認は API・web・ディスク・バックアップ・通報も見る。ここで確かめたい
 * のは版だけなので、**他は全部「正常」か「見ない」に倒す。**倒し方は
 * healthcheck.sh が既に持っている環境変数だけを使う（試験のために
 * スクリプトへ抜け道を足さない）。
 */
async function withWeb(buildTxt, fn) {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ ok: true }))
    }
    if (req.url === '/stories/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end('<h1>Creator Story</h1>')
    }
    if (req.url === '/build.txt') {
      if (buildTxt === null) {
        res.writeHead(404)
        return res.end()
      }
      res.writeHead(200, { 'content-type': 'text/plain' })
      return res.end(buildTxt)
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    return await fn(origin)
  } finally {
    await new Promise((r) => server.close(r))
  }
}

const git = (cwd, ...args) =>
  spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 't@example.test',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 't@example.test',
    },
  })

/**
 * origin（bare）と、そこから引いた作業ツリーを作る。
 * `aheadOfLocal` 本ぶん、origin だけを先に進めておける。
 */
// **await を忘れないこと。**`return fn(...)` と書くと、fn が返した Promise を
// 待たずに finally の rmSync が走り、作業ツリーが検査の前に消える
// （最初にこれを踏んで「手元の checkout を読めません」だけが出た）。
async function withRepo({ aheadOfLocal = 0, remote = null } = {}, fn) {
  const base = mkdtempSync(path.join(tmpdir(), 'cy-deploy-'))
  try {
    const origin = path.join(base, 'origin.git')
    const work = path.join(base, 'work')
    const other = path.join(base, 'other')
    git(base, 'init', '--bare', '--initial-branch=main', origin)
    git(base, 'clone', origin, work)
    git(work, 'commit', '--allow-empty', '-m', '1')
    git(work, 'push', '-u', 'origin', 'main')
    if (aheadOfLocal > 0) {
      git(base, 'clone', origin, other)
      for (let i = 0; i < aheadOfLocal; i += 1) {
        git(other, 'commit', '--allow-empty', '-m', `ahead ${i}`)
      }
      git(other, 'push', 'origin', 'main')
    }
    if (remote !== null) git(work, 'remote', 'set-url', 'origin', remote)
    const head = git(work, 'rev-parse', 'HEAD').stdout.trim()
    assert.match(head, /^[0-9a-f]{40}$/, '試験用の作業ツリーを作れていない')
    return await fn({ dir: work, head })
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

// 同期の spawn は使えない（同じプロセスで HTTP サーバーを立てているため。
// verify-assets.test.mjs の註釈と同じ理由）。
const run = (origin, deployDir, extra = {}) =>
  new Promise((resolve) => {
    const p = spawn('bash', [SCRIPT], {
      env: {
        ...process.env,
        HEALTH_API: origin,
        HEALTH_WEB: origin,
        DEPLOY_DIR: deployDir,
        DATA_MOUNT: '/nonexistent-cy-test',
        BACKUP_CHECK: '0',
        REPORT_CHECK: '0',
        ALERT_WEBHOOK: '',
        NO_PROXY: '127.0.0.1',
        no_proxy: '127.0.0.1',
        ...extra,
      },
    })
    let stdout = ''
    let stderr = ''
    p.stdout.on('data', (c) => (stdout += c))
    p.stderr.on('data', (c) => (stderr += c))
    p.on('close', (status) => resolve({ status, stdout, stderr }))
  })

test('build.txt は「ビルドより前」に書く（書いたものがビルドに乗るため）', () => {
  const sh = readFileSync(path.join(ROOT, 'deploy/apply-latest.sh'), 'utf8')
  const wrote = sh.indexOf('build.txt')
  const built = sh.indexOf('npm run build')
  assert.ok(wrote >= 0, 'apply-latest.sh が版を書いていない')
  assert.ok(built >= 0, 'apply-latest.sh のビルド行が見つからない')
  assert.ok(wrote < built, '版を書くのがビルドより後になっている（配るものに乗らない）')
})

// **これを外すと apply-latest.sh が自分自身を止める。**冒頭で
// `git status --porcelain` が空であることを要求しているため、追跡された
// ファイルを書いた瞬間に「未コミット変更があります」で中止になる。
test('build.txt は git の追跡外（配備が自分自身を止めないため）', () => {
  const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
  assert.match(ignore, /^public\/build\.txt$/m, '.gitignore に public/build.txt が無い')
})

test('配ったものと手元がずれていたら NG（終了コードも変わる）', async () => {
  await withRepo({}, ({ dir }) =>
    withWeb('0'.repeat(40), async (origin) => {
      const r = await run(origin, dir)
      assert.match(r.stdout, /配っているものが手元と違います/, r.stdout + r.stderr)
      assert.notEqual(r.status, 0, '表示は NG なのに終了コードが 0（鳴らない警報）')
    }),
  )
})

// 反映を回すかどうかは社長が決めること。**遅れていること自体は異常ではない。**
// 異常でないものを赤くする警報は、やがて誰も見なくなる。
test('手元が main より古いだけなら NG にしない（注記だけ・終了コードは 0）', async () => {
  await withRepo({ aheadOfLocal: 2 }, ({ dir, head }) =>
    withWeb(head, async (origin) => {
      const r = await run(origin, dir)
      assert.match(r.stdout, /main より 2 本うしろ/, r.stdout + r.stderr)
      assert.doesNotMatch(r.stdout, /NG: 配っているもの/, '遅れを NG にしている')
      assert.equal(r.status, 0, r.stdout + r.stderr)
    }),
  )
})

test('build.txt がまだ置かれていない本番を、壊れ扱いしない', async () => {
  await withRepo({}, ({ dir }) =>
    withWeb(null, async (origin) => {
      const r = await run(origin, dir)
      assert.match(r.stdout, /版: まだ置かれていません/, r.stdout + r.stderr)
      assert.equal(r.status, 0, r.stdout + r.stderr)
    }),
  )
})

// 網が無いことを異常にしない。死活確認は数分おきに回るので、
// 一時的に origin へ届かないだけで赤くすると、やはり誰も見なくなる。
test('origin へ届かなくても NG にしない（網の有無を異常にしない）', async () => {
  await withRepo({ remote: '/nonexistent-cy-origin.git' }, ({ dir, head }) =>
    withWeb(head, async (origin) => {
      const r = await run(origin, dir)
      assert.match(r.stdout, /版: 配っているものと手元は同じ/, r.stdout + r.stderr)
      assert.equal(r.status, 0, r.stdout + r.stderr)
    }),
  )
})

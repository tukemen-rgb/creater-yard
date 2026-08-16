/**
 * deploy/healthcheck.sh の「バックアップの新しさ」の検査（設計 O-1）。
 *
 * 実行: node --test server/healthcheck.test.mjs
 * package.json の test:server への登録は、同じ行を触る PR #11 のマージ後に
 * server/home-hero.test.mjs と 2 つまとめて 1 行で行う
 * （開いている PR と変更ファイルを重ねないため）。
 *
 * ソースの文字列検査ではなく、スクリプトを実際に走らせて出力を見る。
 * healthcheck.sh は `set -uo pipefail`（-e は無い）で、問題を配列にためて
 * 最後に 1 度だけ通知する作りなので、API と web を閉じた port に向けても
 * 最後まで走り切る。よって他の節が NG でも、バックアップの行だけを
 * 見分けられる。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SCRIPT = new URL('../deploy/healthcheck.sh', import.meta.url).pathname

// 実データには一切触れない。閉じた port と存在しない置き場を渡す。
function run(env = {}) {
  const result = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HEALTH_API: 'http://127.0.0.1:1',
      HEALTH_WEB: 'http://127.0.0.1:1',
      DATA_MOUNT: '/nonexistent-creatoryard-test',
      ALERT_WEBHOOK: '',
      ...env,
    },
  })
  return `${result.stdout}${result.stderr}`
}

// NG 行のうち、バックアップについて言っているものだけを拾う。
// API と web は必ず NG になる（閉じた port なので）ため、素朴に
// 「NG があるか」で判定すると、この検査は何も守らなくなる。
//
// 拾うのは 1 件ずつの行（`[health] NG: …`）だけで、最後にまとめて出る
// `[health] CreatorYard healthcheck NG: …` は数えない（同じ文言を含むので、
// 数えると 1 件の問題が 2 件に見える）。
function backupProblems(out) {
  return out
    .split('\n')
    .filter((line) => line.startsWith('[health] NG: ') && line.includes('バックアップ'))
}

function withBackupDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-backup-'))
  try {
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// mtime を「いま から hours 時間前」に戻した書庫を 1 本置く。
function putArchive(dir, name, hoursAgo) {
  const file = path.join(dir, name)
  writeFileSync(file, 'dummy')
  const when = new Date(Date.now() - hoursAgo * 3600 * 1000)
  utimesSync(file, when, when)
  return file
}

test('新しい書庫が在れば鳴らず、経過時間を出す', () => {
  withBackupDir((dir) => {
    putArchive(dir, 'creatoryard-20260816-000000Z.tar.gz', 0)
    const out = run({ BACKUP_DIR: dir })
    assert.deepEqual(backupProblems(out), [])
    assert.match(out, /バックアップ: 0 時間前（creatoryard-20260816-000000Z\.tar\.gz）/)
  })
})

test('閾値を超えて古ければ鳴る', () => {
  withBackupDir((dir) => {
    putArchive(dir, 'creatoryard-20260814-000000Z.tar.gz', 40)
    const out = run({ BACKUP_DIR: dir })
    const problems = backupProblems(out)
    assert.equal(problems.length, 1, out)
    assert.match(problems[0], /最後のバックアップから 40 時間/)
  })
})

test('1 本も無ければ「まだ 1 度も取れていない」と鳴る', () => {
  withBackupDir((dir) => {
    const problems = backupProblems(run({ BACKUP_DIR: dir }))
    assert.equal(problems.length, 1)
    assert.match(problems[0], /1 本もありません/)
  })
})

// 初版は「置き場が無ければ黙って飛ばす」だった。backup.sh は置き場を
// mkdir -p で作るので、1 度も取っていないサーバーにだけ置き場が無い
// ——「いちばん危ない状態だけが静か」になっていたので期待を反転した。
test('置き場そのものが無ければ鳴る（1 度も取れていない状態を黙らせない）', () => {
  const problems = backupProblems(run({ BACKUP_DIR: '/nonexistent-creatoryard-backups' }))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /置き場がありません/)
})

test('BACKUP_CHECK=0 のときだけ黙る（別経路で取る構成を壊さない）', () => {
  const out = run({ BACKUP_DIR: '/nonexistent-creatoryard-backups', BACKUP_CHECK: '0' })
  assert.deepEqual(backupProblems(out), [])
  assert.match(out, /バックアップ: 確認しません（BACKUP_CHECK=0）/)
})

test('名前の形が違うファイルは書庫として数えない', () => {
  withBackupDir((dir) => {
    putArchive(dir, 'other.tar.gz', 0)
    putArchive(dir, 'creatoryard-20260816-000000Z.tar.gz.manifest', 0)
    const problems = backupProblems(run({ BACKUP_DIR: dir }))
    assert.equal(problems.length, 1)
    assert.match(problems[0], /1 本もありません/)
  })
})

test('閾値は環境変数で上げられる', () => {
  withBackupDir((dir) => {
    putArchive(dir, 'creatoryard-20260814-000000Z.tar.gz', 40)
    const out = run({ BACKUP_DIR: dir, BACKUP_MAX_AGE_HOURS: '100' })
    assert.deepEqual(backupProblems(out), [])
    assert.match(out, /バックアップ: 40 時間前/)
  })
})

// 境界を両側から挟んで、閾値の位置そのものを固定する。
// 片側（0 時間・40 時間）だけでは -ge を -gt にずらす変異が素通りする
// ——④の変異検査が実際にそれを見つけた。
test('境界: ちょうど閾値の時間が経っていたら鳴る（36 時間以上）', () => {
  withBackupDir((dir) => {
    putArchive(dir, 'creatoryard-20260815-000000Z.tar.gz', 36)
    const problems = backupProblems(run({ BACKUP_DIR: dir }))
    assert.equal(problems.length, 1, '閾値ちょうどで鳴っていない')
    assert.match(problems[0], /最後のバックアップから 36 時間/)
  })
})

test('境界: 閾値に 1 時間足りなければ鳴らない', () => {
  withBackupDir((dir) => {
    // 35.9 時間前 → 切り捨てで age_h は 35。閾値を 35 に下げる変異を捕らえる
    putArchive(dir, 'creatoryard-20260815-010000Z.tar.gz', 35.9)
    const out = run({ BACKUP_DIR: dir })
    assert.deepEqual(backupProblems(out), [])
    assert.match(out, /バックアップ: 35 時間前/)
  })
})

test('バックアップの検査は他の節を止めない（-e を足していないことの確認）', () => {
  withBackupDir((dir) => {
    putArchive(dir, 'creatoryard-20260816-000000Z.tar.gz', 0)
    const out = run({ BACKUP_DIR: dir })
    // API・web は閉じた port なので必ず NG になる。バックアップの節を
    // 足したことで、その前後の節が飛ばされていないことを見る。
    assert.match(out, /NG: API が応答しません/)
    assert.match(out, /NG: web が応答しません/)
    assert.match(out, /healthcheck NG:/)
  })
})

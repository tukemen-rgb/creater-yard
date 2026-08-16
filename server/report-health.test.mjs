/**
 * deploy/healthcheck.sh の「通報の見落とし」の検査（設計 O-2）。
 *
 * 実行: node --test server/report-health.test.mjs
 * package.json への登録は、同じ行を触る PR #21 のマージ後に 1 行で行う。
 *
 * ソース検査ではなく、スクリプトを実際に走らせて出力を見る。
 *
 * **この試験でいちばん大事なのは「集計保証」（最後の 2 件）。**通報の中身が
 * 出力へ回る道が 1 本も無いことを、目印の文字列で機械的に縛る。設計 O-2 の
 * 指示どおり、それを最初に書いてから他を足した。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SCRIPT = new URL('../deploy/healthcheck.sh', import.meta.url).pathname

// 実データには触れない。API と web は閉じた port へ向けるので、他の節は
// fail を積むだけで最後まで走り切る（healthcheck.sh は -e を持たない）。
function run(env = {}) {
  const result = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HEALTH_API: 'http://127.0.0.1:1',
      HEALTH_WEB: 'http://127.0.0.1:1',
      DATA_MOUNT: '/nonexistent-creatoryard-test',
      BACKUP_CHECK: '0',
      ALERT_WEBHOOK: '',
      ...env,
    },
  })
  return `${result.stdout}${result.stderr}`
}

// 1 件ずつの NG 行だけを拾う。まとめの行（`healthcheck NG: …`）は同じ文言を
// 含むので数えない（O-1 の試験で 1 件の問題が 2 件に見えた失敗と同じ形）。
function reportProblems(out) {
  return out
    .split('\n')
    .filter((line) => line.startsWith('[health] NG: '))
    .filter((line) => line.includes('通報'))
}

function withReportDir(records, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-reports-'))
  try {
    records.forEach((record, i) => {
      const name = `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000.json`
      writeFileSync(
        path.join(dir, name),
        typeof record === 'string' ? record : JSON.stringify(record),
      )
    })
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** hoursAgo 時間前に受け付けた通報のかたち（reports.mjs の保存形に合わせる）。 */
function report({ status = 'open', hoursAgo = 1, extra = {} } = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    ticket: 'R-ABCD-EFGH',
    target: 'story-1',
    category: 'copyright',
    detail: '説明',
    contact: '',
    status,
    note: '',
    createdAt: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  }
}

test('集計保証: 通報の中身は 1 文字も出力に出ない', () => {
  // 本文・対象・連絡先・運営メモ・受付番号のすべてに目印を仕込む
  const marks = [
    'target-must-not-leak-AAA',
    'detail-must-not-leak-BBB',
    'contact-must-not-leak-CCC',
    'note-must-not-leak-DDD',
    'R-LEAK-TICKET',
  ]
  withReportDir(
    [
      report({
        hoursAgo: 40,
        extra: {
          target: marks[0],
          detail: marks[1],
          contact: marks[2],
          note: marks[3],
          ticket: marks[4],
        },
      }),
    ],
    (dir) => {
      const out = run({ REPORT_DIR: dir })
      for (const mark of marks) {
        assert.ok(!out.includes(mark), `${mark} が出力に漏れている`)
      }
      // 鳴ってはいる（黙って通したから漏れていない、では意味がない）
      assert.equal(reportProblems(out).length, 1, out)
    },
  )
})

test('集計保証: 種別も出さない（集中している Story を推測させない）', () => {
  withReportDir([report({ hoursAgo: 40, extra: { category: 'copyright' } })], (dir) => {
    const out = run({ REPORT_DIR: dir })
    assert.ok(!out.includes('copyright'), '種別が出力に漏れている')
    assert.ok(!out.includes('著作権'), '種別の表示名が出力に漏れている')
  })
})

test('置き場が無ければ鳴らない（0 件は正常。バックアップとは逆）', () => {
  const out = run({ REPORT_DIR: '/nonexistent-creatoryard-reports' })
  assert.deepEqual(reportProblems(out), [])
  assert.match(out, /通報: 未対応 0 件（まだ 1 件も届いていません）/)
})

test('対応済みだけなら鳴らない', () => {
  withReportDir(
    [
      report({ status: 'resolved', hoursAgo: 100 }),
      report({ status: 'rejected', hoursAgo: 90 }),
      report({ status: 'reviewing', hoursAgo: 80 }),
    ],
    (dir) => {
      const out = run({ REPORT_DIR: dir })
      assert.deepEqual(reportProblems(out), [], out)
      assert.match(out, /通報: 未対応 0 件/)
    },
  )
})

test('新しい未対応があるだけなら鳴らず、件数と経過時間を出す', () => {
  withReportDir([report({ hoursAgo: 2 }), report({ hoursAgo: 1 })], (dir) => {
    const out = run({ REPORT_DIR: dir })
    assert.deepEqual(reportProblems(out), [], out)
    assert.match(out, /通報: 未対応 2 件（いちばん古いもので 2 時間前）/)
  })
})

test('古い未対応があれば、件数といちばん古いものの経過時間で鳴る', () => {
  withReportDir(
    [
      report({ hoursAgo: 30 }),
      report({ hoursAgo: 10 }),
      report({ hoursAgo: 1 }),
      report({ status: 'resolved', hoursAgo: 200 }),
      report({ status: 'rejected', hoursAgo: 300 }),
    ],
    (dir) => {
      const problems = reportProblems(run({ REPORT_DIR: dir }))
      assert.equal(problems.length, 1)
      // 200 でも 300 でもなく 30。対応済みを数えていたらここで落ちる
      assert.match(problems[0], /未対応の通報が 3 件、いちばん古いもので 30 時間/)
    },
  )
})

test('境界: ちょうど閾値の時間が経っていたら鳴る（24 時間以上）', () => {
  withReportDir([report({ hoursAgo: 24 })], (dir) => {
    const problems = reportProblems(run({ REPORT_DIR: dir }))
    assert.equal(problems.length, 1, '閾値ちょうどで鳴っていない')
    assert.match(problems[0], /いちばん古いもので 24 時間/)
  })
})

test('境界: 閾値に 1 時間足りなければ鳴らない', () => {
  withReportDir([report({ hoursAgo: 23.9 })], (dir) => {
    const out = run({ REPORT_DIR: dir })
    assert.deepEqual(reportProblems(out), [])
    assert.match(out, /いちばん古いもので 23 時間前/)
  })
})

test('読めない通報は数えて鳴らす（黙って捨てない）', () => {
  withReportDir(['{ こわれた JSON', report({ hoursAgo: 1 })], (dir) => {
    const problems = reportProblems(run({ REPORT_DIR: dir }))
    assert.equal(problems.length, 1)
    assert.match(problems[0], /読めない通報が 1 件/)
  })
})

test('REPORT_CHECK=0 のときだけ黙る', () => {
  withReportDir([report({ hoursAgo: 100 })], (dir) => {
    const out = run({ REPORT_DIR: dir, REPORT_CHECK: '0' })
    assert.deepEqual(reportProblems(out), [])
    assert.match(out, /通報: 確認しません（REPORT_CHECK=0）/)
  })
})

test('通報の検査は他の節を止めない（-e を足していないことの確認）', () => {
  withReportDir([report({ hoursAgo: 1 })], (dir) => {
    const out = run({ REPORT_DIR: dir })
    assert.match(out, /NG: API が応答しません/)
    assert.match(out, /NG: web が応答しません/)
  })
})

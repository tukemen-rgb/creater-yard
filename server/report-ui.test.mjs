import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/report/page.common.tsx', import.meta.url), 'utf8')
const adminSource = await readFile(new URL('../app/admin/reports/page.common.tsx', import.meta.url), 'utf8')

test('通報を同期ロックして同じ申立ての二重送信を防ぐ', () => {
  assert.match(source, /const submitLockRef = useRef\(false\)/)
  assert.match(source, /if \(submitLockRef\.current\) return/)
  assert.match(source, /submitLockRef\.current = true/)
  assert.match(
    source,
    /catch \(err\) \{[\s\S]*?submitLockRef\.current = false[\s\S]*?setBusy\(false\)/,
    '送信失敗時はロックを解除して再試行できること',
  )
})

test('通報の状態変更を同期ロックして競合を防ぐ', () => {
  assert.match(adminSource, /const statusUpdateLockRef = useRef\(false\)/)
  assert.match(adminSource, /if \(statusUpdateLockRef\.current\) return/)
  assert.match(adminSource, /statusUpdateLockRef\.current = true/)
  assert.match(
    adminSource,
    /finally \{[\s\S]*?statusUpdateLockRef\.current = false[\s\S]*?setBusyId\(''\)/,
    '状態更新の成功・失敗後にロックを解除して再操作できること',
  )
})

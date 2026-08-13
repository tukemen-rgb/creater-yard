import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/report/page.common.tsx', import.meta.url), 'utf8')

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

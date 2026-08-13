import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/write/page.common.tsx', import.meta.url), 'utf8')

test('Story の保存処理を同期ロックして二重送信を防ぐ', () => {
  assert.match(source, /const saveLockRef = useRef\(false\)/)
  assert.match(source, /if \(saveLockRef\.current\) return/)
  assert.match(source, /saveLockRef\.current = true/)
  assert.match(
    source,
    /catch \(err\) \{[\s\S]*?saveLockRef\.current = false[\s\S]*?setBusy\(false\)/,
    '保存失敗時はロックを解除して再試行できること',
  )
})

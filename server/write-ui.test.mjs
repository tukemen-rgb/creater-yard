import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/write/page.common.tsx', import.meta.url), 'utf8')

test('Story の保存処理を同期ロックして二重送信を防ぐ', () => {
  assert.match(source, /const storyOperationLockRef = useRef\(false\)/)
  assert.match(source, /if \(storyOperationLockRef\.current\) return/)
  assert.match(source, /storyOperationLockRef\.current = true/)
  assert.match(
    source,
    /catch \(err\) \{[\s\S]*?storyOperationLockRef\.current = false[\s\S]*?setBusy\(false\)/,
    '保存失敗時はロックを解除して再試行できること',
  )
})

test('Story の保存と削除を同じ同期ロックで排他化する', () => {
  assert.match(source, /if \(!editId \|\| storyOperationLockRef\.current\) return/)
  assert.match(
    source,
    /storyOperationLockRef\.current = true[\s\S]*?window\.confirm\([\s\S]*?storyOperationLockRef\.current = false[\s\S]*?return/,
    '削除確認中も保存・削除の再実行を防ぎ、取消時はロックを解除すること',
  )
  assert.match(
    source,
    /'削除できませんでした。'\)[\s\S]*?storyOperationLockRef\.current = false[\s\S]*?setBusy\(false\)/,
    '削除失敗時はロックを解除して再試行できること',
  )
})

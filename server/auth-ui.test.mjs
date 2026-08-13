import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pages = [
  ['新規登録', '../app/signup/page.common.tsx', 1],
  ['ログイン', '../app/login/page.common.tsx', 1],
  ['パスワード再設定', '../app/reset/page.common.tsx', 2],
]

for (const [label, path, submitCount] of pages) {
  test(`${label}の認証リクエストを同期ロックして二重送信を防ぐ`, async () => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /const submitLockRef = useRef\(false\)/)
    assert.equal(source.match(/if \(submitLockRef\.current\) return/g)?.length, submitCount)
    assert.equal(source.match(/submitLockRef\.current = true/g)?.length, submitCount)
    assert.equal(
      source.match(/submitLockRef\.current = false/g)?.length,
      submitCount,
      '失敗した処理はロックを解除して再試行できること',
    )
  })
}

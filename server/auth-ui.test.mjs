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

test('アカウント変更・退会・ログアウトを同時実行しない', async () => {
  const source = await readFile(new URL('../app/account/page.common.tsx', import.meta.url), 'utf8')
  assert.match(source, /const accountActionLockRef = useRef\(false\)/)
  assert.equal(source.match(/if \(accountActionLockRef\.current\) return/g)?.length, 3)
  assert.match(
    source,
    /finally \{\s+accountActionLockRef\.current = false\s+setBusy\(false\)/,
    'パスワード変更完了後は次の操作ができること',
  )
  assert.match(
    source,
    /if \([\s\S]*?window\.confirm\([\s\S]*?\)\s*\{\s+accountActionLockRef\.current = false\s+return/,
    '退会確認を取り消したらロックを解除すること',
  )
  assert.match(source, /className="linklike" disabled=\{busy\} onClick=\{logout\}/)
})

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

test('公開の注意書きは、RSS・戻せること・配信済みには効かないことの 3 つを言う', () => {
  // 文言の細部は縛らない（言い回しを直すたびに試験を書き換えさせない）。
  // 3 つの要素が在ることだけを見る（designs I-6）。
  const notice = source.match(/公開すると[\s\S]*?<\/p>/)?.[0] ?? ''
  assert.ok(notice.includes('SITE_FEED'), 'RSS への実リンク（lib/og の SITE_FEED）が在る')
  assert.match(notice, /RSS/, 'RSS に載ることを言う')
  assert.match(notice, /下書きに戻せ/, '戻せることを言う（落とすと脅しになる）')
  assert.match(notice, /消えません/, '配信済みには効かないことを言う')
  assert.match(notice, /下書きはあなたにしか見えません/, '既存の約束を消していない')
  assert.ok(
    source.indexOf('公開すると') < source.indexOf("onClick={() => save('public')}"),
    '注意書きは公開ボタンより前に置く',
  )
})

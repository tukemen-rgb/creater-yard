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

test('画像の説明の欄は、画像を選んだときだけ出す（I-5）', () => {
  assert.match(
    source,
    /\{image && \(\s*<label className="form__field">[\s\S]*?この画像には何が写っていますか/,
    '画像がある時だけ説明欄を出すこと',
  )
  assert.match(source, /maxLength=\{120\}/, '入力側にも上限を示すこと')
  assert.match(
    source,
    /空のままでも保存できます/,
    '空も正しい答えだと書き手に伝えること（強制すると無意味な説明が増える）',
  )
})

test('画像を外したら説明も一緒に消す（画像の無い説明を残さない）', () => {
  assert.match(
    source,
    /setImage\(null\)\s*\n\s*setImageAlt\(''\)/,
    '画像を外す操作で説明も空にすること',
  )
  assert.match(
    source,
    /imageAlt: image \? imageAlt : ''/,
    '画像が無ければ説明を送らないこと（サーバー側の後始末と同じ向き）',
  )
})

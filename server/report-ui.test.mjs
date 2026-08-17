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

/**
 * I-10「果たせない約束を、確認画面から消す」（設計 2026-08-17 12:30・④ 11:10 の指摘 1）。
 *
 * 通報の確認画面は「お問い合わせの際はこの番号をお伝えください」と書いていたが、
 * 問い合わせ先はサイトのどこにも無い（CY_CONTACT_EMAIL はリポジトリ全体で 0 件）。
 * **足りないのではなく、約束して果たしていなかった。**
 *
 * ここで縛るのは「消したこと」と「消しすぎていないこと」の両方である。
 * 試験 1 だけだと、確認画面ごと消しても緑になる。
 */
test('確認画面は、果たせない問い合わせの約束を書かない', () => {
  assert.doesNotMatch(
    source,
    /お問い合わせ/,
    '連絡先が無いのに「お問い合わせの際は」と書くと、利用者にできないことを指示することになる',
  )
})

test('確認画面は、受付番号を出すことをやめない', () => {
  assert.match(source, /受付番号/, '受付番号の見出しが消えている')
  assert.match(source, /\{ticket\}/, '受付番号の値が消えている')
})

test('確認画面は、受理後に何が起きるかを書き続ける', () => {
  assert.match(
    source,
    /運営が内容を確認し/,
    '誰が見るのかが消えると、権利侵害の申し立てが受理されたのか分からなくなる',
  )
  assert.match(
    source,
    /自動で公開が止まることはありません/,
    '通報で自動停止しないことは、通報される側の保護でもあるので消さない',
  )
})

test('通報画面は自ホスト外の URL を持たない', () => {
  const refs = [...source.matchAll(/(?:href|src|action)="([^"]+)"/g)].map((m) => m[1])
  for (const ref of refs) {
    assert.doesNotMatch(ref, /^https?:/, `自ホスト外の参照: ${ref}`)
  }
})

/**
 * 書き写しの網が、鳴るべきときに鳴り、鳴らないときに黙るか
 * （⑤ 14:20 の裁定 2 —— ④が毎周「書き写した」試験を見る、の道具）。
 *
 * **O-5 の教訓をそのまま当てる。**「0 件」を出す検査は、**0 件しか出せない
 * 壊れ方**をする。だから**わざと食い違いを作って、鳴ることを確かめる。**
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SCRIPT = new URL('../scripts/audit-copied-literals.mjs', import.meta.url).pathname
const ROOT = new URL('..', import.meta.url).pathname

const run = () => spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' })

test('いまの試験一式に食い違いは無い（終了コード 0）', () => {
  const r = run()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /食い違い: 0 件/)
})

// **鳴らない警報にしない。**製品側のどこにも無い鍵を書き写した試験を
// 置いて、実際に終了コードが変わることを見る。
test('製品側に無い鍵を書き写したら鳴る（終了コードも変わる）', () => {
  const planted = path.join(ROOT, 'server', 'zz-planted.test.mjs')
  try {
    // **この試験のソースに、その鍵を literal で書かない。**書くと網が
    // 自分自身を拾って、いつまでも鳴りっぱなしになる（実際にそうなった）。
    const key = ['nosuch', 'key'].join('')
    writeFileSync(planted, `const planted = '/write/?${key}=' // 書き写した試験のつもり\n`)
    const r = run()
    assert.notEqual(r.status, 0, '表示だけで終了コードが変わっていない')
    assert.match(r.stdout, new RegExp(key), 'どの鍵が食い違ったのか出ていない')
  } finally {
    rmSync(planted, { force: true })
  }
})

// 数だけ出して終わらせない。何を見ていないかを、道具自身が書いてあること。
test('この網が見ていないものが、道具のそばに書いてある', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(SCRIPT, 'utf8')
  assert.match(src, /この網が見ていないもの/, '分母が書かれていない')
  assert.match(src, /網であって、証明ではない/, '一致＝正しい と読まれかねない')
})

// 使い捨ての置き場は作らない（この試験自身が仕込みを消す）ことの確認。
test('仕込みを消し忘れていない', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cy-audit-'))
  rmSync(dir, { recursive: true, force: true })
  const r = run()
  assert.equal(r.status, 0, '前の試験の仕込みが残っている')
})

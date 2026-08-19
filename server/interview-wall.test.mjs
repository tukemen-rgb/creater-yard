/**
 * ヒアリングの答えを持ったまま登録・ログインの壁に着いたとき、
 * **答えが残っていることを画面が言う**（設計 U-7）。
 *
 * ①が 2026-08-19 に実物を歩いて測った: 4 問答えた直後に `/signup/` へ送られ、
 * 答えは端末に残って登録後に全部戻る。**ところが画面には、それを伝える語が
 * 1 つも無かった**（「残」「保存」「消え」「戻」「下書き」「ヒアリング」
 * 「回答」の 7 語すべて不在）。**やっていることは正しく、伝えていないだけ。**
 *
 * 事例 74（NN/g）——「情報が無いことは、制御が無いことと同じ」。
 *
 * 壁は 2 枚ある。`/signup/` と、そこから行ける `/login/`。
 * **片方だけ直すと、既にアカウントを持っている人が置き去りになる。**
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')

const WALLS = ['app/signup/page.common.tsx', 'app/login/page.common.tsx']
const sources = Object.fromEntries(await Promise.all(WALLS.map(async (p) => [p, await read(p)])))

test('2 枚の壁とも、ヒアリングの下書きがあるかを見ている', () => {
  for (const [name, src] of Object.entries(sources)) {
    assert.match(src, /hasInterviewDraft/, `${name}: 下書きの有無を見ていない`)
  }
})

// 静的書き出しでは、事前描画のときに端末の保存領域が無い。描画中に見ると
// **出来上がった HTML と、画面に出るものが食い違う**（hydration の食い違い）。
// 既にある edit-link.tsx / write-next-link.tsx と同じ形にそろえる。
test('知らせるかどうかは、画面が出たあとに決める（事前描画と食い違わせない）', () => {
  for (const [name, src] of Object.entries(sources)) {
    assert.match(src, /useState\(false\)/, `${name}: 初期値が false でない`)
    assert.match(
      src,
      /useEffect\(\(\) => \{?\s*set\w*\(hasInterviewDraft\(\)\)/,
      `${name}: 下書きの有無を描画中に見ている`,
    )
  }
})

test('伝える文に「残」が入っている（消えないと読める語）', () => {
  for (const [name, src] of Object.entries(sources)) {
    const said = src.match(/[^\n]*残っています[^\n]*/)
    assert.ok(said, `${name}: 答えが残ることを言っていない`)
  }
})

// ふつうに登録・ログインしに来た人には関係が無い。無条件に出すと、
// 書いていない人に「あなたの答え」と言うことになる。
//
// **最初はここを `/\{\w+ && \(/` で書いて、`{true && (` に変える変異が
// 緑のまま通った。**`true` も `\w+` に当たる。名前があることではなく、
// **その名前が画面の状態であること**を見なければ意味が無い。
// ただし名前そのものは縛らない（同じ意味の書き直しで赤くしないため）。
test('ヒアリングから来ていない人には出さない（条件が状態になっている）', () => {
  for (const [name, src] of Object.entries(sources)) {
    const guard = /\{\s*(\w+) && \(\s*\n\s*<p className="notice">\s*\n\s*さっき答えた/.exec(src)
    assert.ok(guard, `${name}: 知らせに条件が付いていない`)
    const flag = guard[1]
    assert.ok(flag !== 'true', `${name}: 知らせを無条件に出している`)
    assert.match(
      src,
      new RegExp(`const \\[${flag},\\s*set\\w+\\] = useState\\(false\\)`),
      `${name}: 条件が画面の状態になっていない（${flag}）`,
    )
  }
})

// 既にある道。U-7 は文言を足すだけで、行き先は 1 つも変えない。
test('登録・ログインのあとの行き先を変えていない', () => {
  for (const [name, src] of Object.entries(sources)) {
    assert.match(
      src,
      /hasInterviewDraft\(\) \? '\/write\/\?restore=interview'/,
      `${name}: 答えを戻す行き先が変わった`,
    )
  }
})

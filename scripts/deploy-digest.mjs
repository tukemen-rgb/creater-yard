#!/usr/bin/env node
/**
 * 「反映すると何が変わるか」を作り直す（設計 D-1）。
 *
 * **なぜ背圧の最中にこれを作ったか。**⑤ 03:30 の裁定は、反映が溜まっている
 * 間に③が作ってよいものを 2 つに絞った —— (1) 反映を安全にする・楽にする
 * もの (2) 本番でいま壊れているものの直し。**これは (1) にあたる。**
 *
 * 2026-08-20 02:40 に「反映すると何が変わるか」を **41 本ぶん手で分類して**
 * 社長へ出した。**その 1 時間後には 44 本、2 時間後には 47 本**になった。
 * **社長が読む唯一の判断材料が、毎周古くなる。**しかも手で分けると
 * **境目が周ごとにぶれる**（あの日の「画面／配るもの／内側」はその場で
 * 決めたもの）。
 *
 * 使い方:
 *   node scripts/deploy-digest.mjs                        … 人が読む形
 *   node scripts/deploy-digest.mjs --markdown             … Issue へ貼る形
 *   node scripts/deploy-digest.mjs --since '<日時>'       … 起点を渡す
 *
 * **起点を渡さなかったときだけ**本番へ聞きに行く（公開資産の
 * `last-modified`。④が毎周使っているのと同じ 1 か所）。**試験は必ず渡す**
 * ので、試験が外へ出ることはない。
 *
 * 出さないもの: 作者名（個人単位の記録を作らない方針）・鍵・トークン。
 * 出すのは commit の題だけ。
 */
import { execFileSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname

/** git は必ず配列で渡す（文字列を shell に解釈させない）。 */
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
}

/**
 * 束ね方。**触ったファイルだけで決まる**（読む人がその場で決めない）。
 * 上から順に当て、最初に当たった束に入れる。
 */
const BUCKETS = [
  {
    key: '画面で気づくもの',
    // 画面の試験は `server/` に置く決まりなので、ここで弾く条件は要らない
    // （`app/` `components/` の下に試験ファイルは 1 つも無い。数えて確かめた）
    hit: (f) => /^(app|components)\//.test(f),
  },
  {
    key: '配られるもの',
    hit: (f) => f === 'server/api.mjs' || /^server\/lib\/feed/.test(f) || /^public\//.test(f),
  },
]
const REST = '内側だけ'

/**
 * マージの題から PR 番号と題名を取る。**書き方は 1 通りではない。**
 * この repo の履歴に実際に在る 3 通りを受ける（数えて確かめた）:
 *
 *   Merge PR #61: 他人の記録を…            … このループの押し方
 *   Merge pull request #5 from tukemen-rgb/…  … GitHub の既定
 *   Creator Story MVPを統合 (#4)              … squash
 *
 * **最初は 1 通りしか受けず、あとの 2 つを「枝の取り込み」に落としていた。**
 * 社長が GitHub の画面から押したものが、まとめから消える形だった。
 */
export function parsePr(subject) {
  const explicit = /^Merge PR #(\d+): (.+)$/.exec(subject)
  if (explicit) return { number: explicit[1], title: explicit[2] }
  const fromBranch = /^Merge pull request #(\d+) from (.+)$/.exec(subject)
  if (fromBranch) return { number: fromBranch[1], title: fromBranch[2] }
  const squashed = /^(.+) \(#(\d+)\)$/.exec(subject)
  if (squashed) return { number: squashed[2], title: squashed[1] }
  return null
}

export function classify(files) {
  for (const bucket of BUCKETS) {
    if (files.some(bucket.hit)) return bucket.key
  }
  return REST
}

/** 本番が最後に更新された時刻。**起点が渡されたときは呼ばない。** */
async function servedSince() {
  const res = await fetch('https://creatoryard.io/_next/static/css/5f35ef91502e13b3.css', {
    method: 'HEAD',
  })
  const value = res.headers.get('last-modified')
  if (!value) throw new Error('本番の last-modified が取れませんでした')
  return value
}

export function collect(since) {
  const lines = git(['log', '--first-parent', '--reverse', '--merges', `--since=${since}`,
    '--format=%H\t%s', 'origin/main']).trim()
  const merges = lines ? lines.split('\n') : []
  const groups = new Map([...BUCKETS.map((b) => [b.key, []]), [REST, []]])
  const branchMerges = []
  for (const line of merges) {
    const [hash, subject] = line.split('\t')
    const files = git(['diff', '--name-only', `${hash}^1`, hash]).split('\n').filter(Boolean)
    const pr = parsePr(subject)
    if (!pr) {
      // 枝の取り込み（PR 番号を持たない）。**別に数える** ——
      // 2026-08-20 に「41 本」と「44 本」の食い違いが出たのがこれ。
      branchMerges.push(subject)
      continue
    }
    groups.get(classify(files)).push(pr)
  }
  return { groups, branchMerges, total: merges.length }
}

function render({ groups, branchMerges, total }, { markdown }) {
  const out = []
  const h = (text) => out.push(markdown ? `### ${text}` : `== ${text}`)
  const item = (text) => out.push(markdown ? `- ${text}` : `  - ${text}`)
  for (const [name, rows] of groups) {
    if (rows.length === 0) continue
    h(`${name}（${rows.length} 本）`)
    for (const row of rows) item(`**#${row.number}** ${row.title}`)
    out.push('')
  }
  if (branchMerges.length > 0) {
    h(`枝の取り込み（${branchMerges.length} 本・画面は変わりません）`)
    for (const subject of branchMerges) item(subject)
    out.push('')
  }
  const counted = [...groups.values()].reduce((n, rows) => n + rows.length, 0) + branchMerges.length
  out.push(`合計 ${total} 本（内訳の合計 ${counted} 本）`)
  return out.join('\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const sinceAt = args.indexOf('--since')
  const since = sinceAt >= 0 ? args[sinceAt + 1] : await servedSince()
  console.log(`起点: ${since}\n`)
  console.log(render(collect(since), { markdown: args.includes('--markdown') }))
}

/**
 * 港（ポート）が、配備のファイルどうしで食い違わないこと。
 *
 * **2026-08-17 の本番で実際に起きた形**: web を 3001 へ移したのに死活確認の
 * 見に行く先を直さず、**死活確認が 3000（＝ GAMEYARD）を見て鳴り続けた。**
 * その後 `deploy/creatoryard.env.example` に注意書きが入り、`GO-LIVE.md` にも
 * 「変える場所は 3 か所」と書かれた —— **どちらも人が読んで守るもの。**
 *
 * ここで縛るのは、**既定値どうしが最初から揃っているか**である。
 * `healthcheck.sh` は環境変数が無いときに既定の港へ行く。その既定が
 * unit ファイルや設定例とずれていると、**何も設定していない素の状態で
 * すでに隣を見ている。**
 *
 * **数を書き写さない。**両方のファイルから取り出して比べる。
 *
 * ①はこの周、**「`HEALTH_WEB` が設定例に無い」と誤って読んだ**
 * （`^NAME=` しか探さず、コメント例を数えなかった）。**実際は在った。**
 * 誰も見ていなかったのは、設定例の有無ではなく**既定値どうしの一致**だった。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const health = read('deploy/healthcheck.sh')
const webUnit = read('deploy/creatoryard-web.service')
const envExample = read('deploy/creatoryard.env.example')
const apply = read('deploy/apply-latest.sh')

/** `VAR="${VAR:-http://host:PORT}"` の既定から港を取る。 */
function defaultPort(name) {
  const m = new RegExp(String.raw`\$\{${name}:-https?://[^:]+:(\d+)`).exec(health)
  assert.ok(m, `${name} の既定が healthcheck.sh から読み取れない`)
  return m[1]
}

test('死活確認が既定で見る web の港が、web の unit と同じ', () => {
  const unit = /next start[^\n]*-p (\d+)/.exec(webUnit)
  assert.ok(unit, 'web の unit から港が読み取れない')
  assert.equal(
    defaultPort('HEALTH_WEB'),
    unit[1],
    '素の状態で、死活確認が web 以外を見に行く（2026-08-17 に本番で起きた形）',
  )
})

test('死活確認が既定で見る API の港が、設定例の CY_API_PORT と同じ', () => {
  const port = /^CY_API_PORT=(\d+)/m.exec(envExample)
  assert.ok(port, '設定例から CY_API_PORT が読み取れない')
  assert.equal(
    defaultPort('HEALTH_API'),
    port[1],
    '素の状態で、死活確認が API 以外を見に行く',
  )
})

/**
 * **港を変える場所が何か所あるかを、人が数えないで済むようにする。**
 * 設定例の註釈が「3 か所」と言っているので、その 3 か所が実在することを見る
 * （unit・nginx の例・死活確認の見に行く先）。
 */
test('港を変える場所が、註釈の言うとおり実在する', () => {
  const nginx = read('deploy/nginx.conf.example')
  const webPort = /next start[^\n]*-p (\d+)/.exec(webUnit)[1]
  assert.ok(nginx.includes(`:${webPort}`), `nginx の例が web の港（${webPort}）を指していない`)
  assert.match(envExample, /HEALTH_WEB=/, '設定例に死活確認の見に行く先が無い')
})

// 配る設定に、誰も読まないものを混ぜない（読む側から取り出して比べる）。
test('設定例に書いてある変数は、どこかで読まれている', () => {
  const declared = [...envExample.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1])
  assert.ok(declared.length > 0, '設定例から変数を読み取れない')
  const sources = ['server/api.mjs', 'server/lib/auth.mjs', 'server/lib/mailer.mjs', 'deploy/healthcheck.sh', 'deploy/backup.sh', 'deploy/apply-latest.sh', 'deploy/creatoryard-web.service', 'deploy/creatoryard-api.service', 'next.config.mjs']
    .map((f) => read(f))
    .join('\n')
  const unread = [...new Set(declared)].filter((name) => !sources.includes(name))
  assert.deepEqual(unread, [], `設定例に在るのに、どこも読んでいない: ${unread.join(' ')}`)
})

/**
 * **分母がひとつ足りなかった。**この試験を書いた最初の版は、unit と
 * healthcheck と設定例の 3 か所しか見ていなかった。翌る周に数え直したら、
 * **`deploy/apply-latest.sh` が 4 か所目**で、**そこだけ 3001 を直に
 * 書いていた**（ほかの 3 か所は 3000）。
 *
 * `set -eu` と `curl --fail` があるので、ここが違うと**サービスを再起動した
 * あとの最後の行で反映が失敗する。**社長が押す 1 コマンドの、いちばん最後。
 *
 * どちらが本番の港かは、この repo からは決められない（GO-LIVE には
 * 同居機なら 3001 へ移すと書いてある）。**だから数を直すのではなく、
 * 書き写しをやめさせる。**
 */
test('反映の確認が、港を直に書いていない', () => {
  const web = /WEB_CHECK="\$\{HEALTH_WEB:-[^"]*"/.exec(apply)
  assert.ok(web, '反映の確認が、死活確認と同じ変数を見ていない')
  const api = /API_CHECK="\$\{HEALTH_API:-[^"]*"/.exec(apply)
  assert.ok(api, 'API の確認が、死活確認と同じ変数を見ていない')
  const hardcoded = apply
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .filter((line) => /curl[^\n]*127\.0\.0\.1:\d+/.test(line))
  assert.deepEqual(hardcoded, [], `港を直に書いている行が残っている:\n  ${hardcoded.join('\n  ')}`)
})

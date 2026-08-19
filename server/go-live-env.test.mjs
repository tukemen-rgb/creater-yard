/**
 * **手順書が名指しする設定は、設定例に在ること。**
 *
 * `deploy/GO-LIVE.md` は本番を立てる人が上から順に読む唯一の紙で、
 * そこに書かれた設定名を人がそのまま `/etc/creatoryard/creatoryard.env` へ
 * 写す。**手順書にしか無い名前**があると、写した人は「書いたのに効かない」
 * ところで詰まる —— しかもその時点では、**打ち間違いと区別がつかない。**
 *
 * 逆向き（設定例にあって手順書に無い）は**縛らない。**設定例には既定値で
 * 足りるものが並んでおり、全部を手順書に写させるほうが害になる。
 *
 * **名前を書き写さない。**手順書から取り出して、設定例に在るかを見る。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const goLive = read('deploy/GO-LIVE.md')
const envExample = read('deploy/creatoryard.env.example')

/** 手順書が名指ししている設定名（この repo の env はこの接頭辞で始まる）。 */
function namedEnvVars() {
  const found = goLive.match(/\b(?:CY|MAIL|SMTP|HEALTH|BACKUP|REPORT|AUTH)_[A-Z0-9_]+\b/g) ?? []
  return [...new Set(found)].sort()
}

test('手順書が名指しする設定が、すべて設定例に在る', () => {
  const names = namedEnvVars()
  assert.ok(names.length > 0, '手順書が設定名を 1 つも挙げていない（試験の前提が崩れている）')
  for (const name of names) {
    assert.ok(
      new RegExp(String.raw`\b${name}\b`).test(envExample),
      `${name} は手順書にしか無い（写した人が「書いたのに効かない」で詰まる）`,
    )
  }
})

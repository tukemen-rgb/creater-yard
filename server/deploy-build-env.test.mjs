/**
 * **静的に書き出す面は、ビルド時に env を読む。**
 *
 * systemd の `EnvironmentFile=` は**動いているサービス**にしか効かない。
 * だから `deploy/apply-latest.sh` が同じ設定ファイルをビルドの前に読まないと、
 * **静的な面からだけ設定が抜ける。**
 *
 * **2026-08-20 に本番で確かめた形**:
 *
 *   /          canonical 無し   ← 静的に書き出した面
 *   /stories/  canonical 有り   ← server が描く面
 *
 * 両方とも同じ `absoluteUrl()` を呼んでいるので、**差はビルド時の env にしかない。**
 * `CY_CONTACT_EMAIL`（`/data-policy/` の連絡先）も同じ理由で、設定ファイルに
 * 書いても節が出ないままだった。
 *
 * **名前を書き写さない。**「ビルド時に要る env」は**製品コードから取り出す** ——
 * `'use client'` でないファイルが読んでいる `CY_*` がそれである。
 * 書き写すと、新しい設定を足した人がここを直さずに済んでしまう。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8')
const apply = read('deploy/apply-latest.sh')
const envExample = read('deploy/creatoryard.env.example')

/** app/ と lib/ の中を全部たどる（拡張子は問わない）。 */
function walk(dir) {
  const out = []
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name)
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel))
    else out.push(rel)
  }
  return out
}

/**
 * **ビルド時に要る env の名前**を製品コードから取り出す。
 * `'use client'` のファイルは数えない —— あちらの `process.env` は
 * ブラウザ側で消えるので、ビルド時に読ませても意味が無い。
 */
function buildTimeEnvNames() {
  const names = new Set()
  for (const rel of [...walk('app'), ...walk('lib')]) {
    const source = read(rel)
    if (/^\s*['"]use client['"]/.test(source)) continue
    for (const m of source.matchAll(/process\.env\.(CY_[A-Z0-9_]+)/g)) names.add(m[1])
  }
  return [...names].sort()
}

/** 設定例の見出しが名指ししている置き場（`/etc/...` の 1 本目）。 */
function documentedEnvPath() {
  const m = /(\/etc\/[A-Za-z0-9._/-]*\.env)\b/.exec(envExample)
  assert.ok(m, '設定例が置き場を書いていない')
  return m[1]
}

test('ビルド時に要る env が、設定例に載っている', () => {
  const names = buildTimeEnvNames()
  assert.ok(names.length > 0, 'ビルド時に env を読む製品コードが 1 つも見つからない')
  for (const name of names) {
    assert.ok(
      envExample.includes(name),
      `${name} をビルド時に読んでいるのに、設定例に無い（本番で誰も設定できない）`,
    )
  }
})

test('反映の手順が、ビルドより前に設定を読む', () => {
  const load = apply.indexOf('. "$CY_ENV_FILE"')
  const build = apply.indexOf('npm run build')
  assert.notEqual(load, -1, '設定ファイルを読んでいない（静的な面から設定が抜ける）')
  assert.notEqual(build, -1, 'ビルドの行が見つからない')
  assert.ok(load < build, '設定を読むのがビルドより後になっている（間に合わない）')
})

test('読んだ設定が、ビルドに渡る形になっている', () => {
  // `. file` だけでは、その場のシェル変数になるだけで子プロセス（npm）へ渡らない。
  const block = /set -a\s+\.\s+"\$CY_ENV_FILE"\s+set \+a/.exec(apply)
  assert.ok(block, 'set -a で囲っていない（読んでも npm run build へ渡らない）')
})

test('設定の置き場は、設定例が名指ししている場所と同じ', () => {
  const documented = documentedEnvPath()
  const fallback = new RegExp(String.raw`CY_ENV_FILE:-(${documented.replace(/[.]/g, '\\.')})\b`)
  assert.match(
    apply,
    fallback,
    `既定の置き場が設定例（${documented}）と食い違っている`,
  )
})

test('読めなくても反映は止まらない（ただし何が抜けるか言う）', () => {
  const elseBranch = apply.slice(apply.indexOf('. "$CY_ENV_FILE"'))
  assert.match(elseBranch, /else/, '読めなかったときの枝が無い')
  assert.doesNotMatch(
    elseBranch.slice(0, elseBranch.indexOf('npm ci')),
    /exit 1/,
    '設定が読めないだけで反映を止めている（反映を妨げるほうが害が大きい）',
  )
  assert.match(elseBranch, /canonical/, '何が抜けるかを言っていない')
})

/**
 * **読む行を足しただけでは足りない。**置き場が違えば、また黙って設定の
 * 抜けた版が出来上がる。だから**出来上がったものを見て**確かめる。
 *
 * **配る場所を書き写さない。**配置の行（`rsync … <dir>/ …`）から取り出す。
 */
function staticOutDir() {
  const m = /rsync\s+-a\s+--delete\s+([A-Za-z0-9_.-]+)\//.exec(apply)
  assert.ok(m, '配置の行から、書き出し先が読み取れない')
  return m[1]
}

test('ビルドのあとで、設定が届いたかを出来上がったものから確かめる', () => {
  const dir = staticOutDir()
  const check = apply.indexOf(`grep -q 'rel="canonical"' ${dir}/index.html`)
  assert.notEqual(check, -1, `${dir}/index.html を見て確かめていない`)
  assert.ok(apply.indexOf('npm run build') < check, 'ビルドより前に確かめている')
  assert.ok(check < apply.indexOf('rsync'), '配置より後に確かめている（もう遅い）')
})

test('届いていなければ、配置する前に止まる', () => {
  const check = apply.indexOf(`grep -q 'rel="canonical"'`)
  // **確認そのものが無いときに緑にしない。**`indexOf(x, -1)` は先頭から
  // 探すので、この一行が無いと**手順書のいちばん上の `exit 1`** を拾って
  // 通ってしまう（直す前の手順書に当てて、実際にそうなった）。
  assert.notEqual(check, -1, '届いたかの確認そのものが無い')
  const stop = apply.indexOf('exit 1', check)
  assert.notEqual(stop, -1, '届いていなくても続けている（黙って設定の抜けた版を配る）')
  assert.ok(stop < apply.indexOf('rsync'), '止まるのが配置より後になっている')
})

test('確かめる印は、製品コードが本当に出すものである', () => {
  // 印（canonical）と、その出どころ（CY_SITE_ORIGIN）が切れていたら、
  // 上の確認は「いつも赤い」か「いつも緑」のどちらかになる。
  const home = read('app/page.common.tsx')
  assert.match(home, /alternatesFor\(canonical\)/, 'トップが canonical を出していない')
  assert.match(
    read('lib/og.ts'),
    /process\.env\.CY_SITE_ORIGIN/,
    'canonical の出どころが CY_SITE_ORIGIN でない',
  )
})

test('手順書が POSIX sh として壊れていない', () => {
  // `set -a` の囲いと、届いたかの確認を足したので、構文そのものを確かめる。
  execFileSync('sh', ['-n', path.join(ROOT, 'deploy/apply-latest.sh')])
})

/**
 * **端末に残るものの一覧が、実装と一致していること。**
 *
 * `/data-policy/` は自分の註釈でこう決めている:
 *
 * > ここに書いたことは実装の事実と一致させる（**書くだけの約束にしない**）
 *
 * ところが 2026-08-20 に数えたら、**端末に残るものを 1 つも書いていなかった**
 * （実際には 5 つある）。書いただけでは同じことがまた起きるので、
 * **機械で突き合わせる。**
 *
 * **鍵を書き写さない。**製品コードから拾った鍵の集合と、一覧の集合を比べる。
 * 片方にしか無い鍵があれば赤くなる。
 */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const table = read('lib/device-storage.ts')
const page = read('app/data-policy/page.common.tsx')

/** 註釈は約束ではない（`scripts/audit-copied-literals.mjs` と同じ扱い）。 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

/**
 * **実装が実際に端末へ置いている鍵。**
 *
 * `localStorage` に渡している名前は、この repo では定数に入っている
 * （`const TOKEN_KEY = 'cy-token'` の形）。**その定数の値を拾う。**
 * 一覧そのもの（`lib/device-storage.ts`）は対象から外す —— 自分を数えると
 * 「一覧に在るから正しい」になって、何も守らない。
 */
function keysUsedByCode() {
  const found = new Set()
  const files = ['app/**/*.tsx', 'app/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts']
    .flatMap((g) => globSync(g, { cwd: ROOT }))
    .filter((f) => f !== 'lib/device-storage.ts')
  for (const rel of files) {
    const source = withoutComments(read(rel))
    // **囲いを 1 か所に集めた（U-13）ので、`localStorage` の語だけでは
    // 探せなくなった。**いまは `readValue` などに鍵を渡している側を見る。
    // 両方を見るのは、片方に戻したときも気づけるようにするため。
    if (!/localStorage|readValue|writeValue|removeValue/.test(source)) continue
    for (const m of source.matchAll(/'((?:cy-|creatoryard:)[A-Za-z0-9:_-]+)'/g)) found.add(m[1])
  }
  return [...found].sort()
}

/** 一覧が挙げている鍵。 */
function keysInTable() {
  return [...withoutComments(table).matchAll(/key: '([^']+)'/g)].map((m) => m[1]).sort()
}

test('端末に置く鍵が、一覧と過不足なく一致する', () => {
  const used = keysUsedByCode()
  const listed = keysInTable()
  assert.ok(used.length > 0, '端末に置く鍵が 1 つも見つからない（試験の前提が崩れている）')
  assert.deepEqual(
    listed,
    used,
    `一覧と実装がずれている（一覧: ${listed.join(' ')} ／ 実装: ${used.join(' ')}）`,
  )
})

test('画面は一覧から描いている（文言を直書きしていない）', () => {
  assert.match(page, /DEVICE_STORAGE\b/, '画面が一覧を参照していない')
  for (const key of keysInTable()) {
    assert.ok(
      !page.includes(`'${key}'`) && !page.includes(`>${key}<`),
      `画面に鍵「${key}」を直書きしている（一覧から描くこと）`,
    )
  }
})

/**
 * **ブラウザが勝手に消すことを、画面が言っていること。**
 *
 * 「自分で外したとき」だけを書くと、**7 日で消えることを知らない人は
 * 「消えないもの」と読む**（事例 83・MDN）。
 */
test('ブラウザが消すことを、画面が言っている', () => {
  assert.match(table, /7 日/, '一覧が 7 日の話を持っていない')
  assert.match(table, /Safari/, 'どのブラウザの話かを言っていない')
  assert.match(page, /DEVICE_STORAGE_EVICTION\b/, '画面がその文を出していない')
})

/** 上限は `lib/saved-stories.ts` から取る（数を書き写さない）。 */
test('「あとで読む」の本数を、一覧が書き写していない', () => {
  assert.match(table, /MAX_SAVED_STORIES/, '上限を数で書き写している')
})

/**
 * ここから下は**触り方**（U-13）。
 *
 * `localStorage` は**触っただけで落ちる**ことがある（事例 84）。
 * 2026-08-20 に数えたら**穴が 6 か所**あり、しかも**囲っていない読み取りを
 * 呼ぶのは全ページのヘッダー**だった。
 *
 * **関数ごとに `try` を数える試験にはしない**（また抜ける）。
 * **直に触るファイルが 1 本であること**を見る。
 */
test('端末の保存領域を直に触るのは、1 つのファイルだけ', () => {
  const offenders = ['app/**/*.tsx', 'app/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts']
    .flatMap((g) => globSync(g, { cwd: ROOT }))
    .filter((f) => f !== 'lib/device-storage.ts')
    .filter((f) => /window\.(local|session)Storage/.test(withoutComments(read(f))))
  assert.deepEqual(
    offenders,
    [],
    `直に触っているファイルがある（囲いが要る）: ${offenders.join(' ')}`,
  )
})

test('その 1 本の中で、触る場所はすべて囲われている', () => {
  const source = withoutComments(table)
  for (const fn of ['readValue', 'writeValue', 'removeValue']) {
    const at = source.indexOf(`export function ${fn}`)
    assert.notEqual(at, -1, `${fn} が無い`)
    const body = source.slice(at, source.indexOf('\n}', at))
    assert.match(body, /try\s*\{/, `${fn} が囲われていない`)
    assert.match(body, /catch/, `${fn} が受け止めていない`)
  }
})

/**
 * **「残せたか」を返す関数を、名前ではなく型で数える**（T-1・⑤ 19:30 の指示）。
 *
 * 前はここに **`saveSession` の呼び出し元しか数えない**試験があった。
 * 同じ変更で「残せたか」を返すようにした関数は 4 つあり、
 * **そのうち 1 つが穴のまま入った**（PR #76 → 1 時間後に #78 で塞いだ）。
 * **落とし穴 B（分母の切り方が浅い）。**
 *
 * **名前の一覧は持たない。**一覧は足し忘れると、その関数が最初から網の外になる。
 * 代わりに **`Kept` という印**（`lib/device-storage.ts`）で数える。
 *
 * **例外は「受け取らない理由:」を書いた場所だけ。**理由の無い例外を許すと、
 * この検査はやがて「例外の一覧」になって読まれなくなる
 * （`server/css-classes.test.mjs` の註と同じ考え方）。
 */
const EXEMPT = '受け取らない理由:'

/** `lib/` の中で、端末へ書き出している export された関数。 */
function writerFunctions() {
  const out = []
  for (const rel of globSync('lib/**/*.ts', { cwd: ROOT })) {
    const source = read(rel)
    const parts = source.split(/(?=^export function )/m)
    for (const part of parts) {
      const m = /^export function (\w+)\s*\([\s\S]*?\)\s*:?\s*([^{]*)\{/.exec(part)
      if (!m) continue
      const body = withoutComments(part)
      if (!/\bwriteValue\(/.test(body)) continue
      out.push({ file: rel, name: m[1], returns: m[2].trim(), source: part })
    }
  }
  return out
}

test('端末へ書き出す関数は、残せたかを返す（返さないなら理由が要る）', () => {
  const writers = writerFunctions()
  assert.ok(writers.length >= 3, `書き出す関数が少なすぎる（${writers.length} 件。前提が崩れている）`)
  for (const w of writers) {
    if (w.source.includes(EXEMPT)) continue
    assert.match(
      w.returns,
      /\bKept\b/,
      `${w.file} の ${w.name} が「残せたか」を返していない（返さないなら「${EXEMPT}」を書く）`,
    )
  }
})

test('残せたかを返す関数は、呼び出し元が受け取っている', () => {
  const names = writerFunctions()
    .filter((w) => /\bKept\b/.test(w.returns))
    .map((w) => w.name)
  // 印を付けた関数を他から呼んでいる場所（`toggleSavedStory` のように
  // `Kept` を包んで返すものも、包んだ側が数えられる）
  const wrappers = ['toggleSavedStory']
  const targets = [...new Set([...names, ...wrappers])]
  assert.ok(targets.length >= 3, '数える相手が少なすぎる（前提が崩れている）')

  const files = ['app/**/*.tsx', 'app/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts']
    .flatMap((g) => globSync(g, { cwd: ROOT }))
  for (const rel of files) {
    const lines = read(rel).split('\n')
    lines.forEach((line, i) => {
      for (const name of targets) {
        // **`return` を使わない。**forEach の中の return はその行の残りの
        // 名前まで飛ばすので、**1 つ目の名前しか数えない試験**になる。
        // （この試験そのものが「分母の切り方が浅い」を踏みかけた。実際に
        // 穴を作って確かめたら、片方の試験でしか赤くならず気づいた。）
        if (!new RegExp(`(^|[^.\\w])${name}\\(`).test(line)) continue
        if (/^\s*(export )?function /.test(line)) continue // 宣言そのもの
        if (/^\s*(\/\/|\*)/.test(line)) continue // 註釈
        const received =
          /(if \(!|=\s*|return |\}\s*=\s*|\(\s*!)/.test(line) ||
          /\breturn\b/.test(line)
        const excused = [lines[i - 1], lines[i - 2]].some((l) => l?.includes(EXEMPT))
        assert.ok(
          received || excused,
          `${rel}:${i + 1} が ${name} の結果を捨てている（捨てるなら「${EXEMPT}」を書く）`,
        )
      }
    })
  }
})

test('理由を書いた例外が、実在する数だけある', () => {
  // **例外そのものを数える。**増えていたら、この数を直すときに人が気づく。
  const files = ['app/**/*.tsx', 'app/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts']
    .flatMap((g) => globSync(g, { cwd: ROOT }))
  const excused = files.filter((f) => read(f).includes(EXEMPT))
  assert.deepEqual(
    excused.sort(),
    ['app/saved/page.common.tsx', 'lib/story-interview.ts'],
    '理由つきの例外が増減している（増やすなら、なぜ受け取らないかをここでも確かめる）',
  )
})

/**
 * ここから下は**受け取っているか**（U-15）。
 *
 * U-13 で「保存できたか」を返すようにしたが、**返しただけでは足りない** ——
 * **受け取らなければ、黙って捨てるのと同じ**である。
 *
 * > `When users know the current system status, they learn the outcome of their
 * > prior interactions and determine next steps.` —— NN/g #1（事例 86）
 *
 * **source 検査だけにしない。**端末の保存領域の代わりを置いて、
 * **実際に投げさせて確かめる。**
 */
function withBrokenStorage() {
  const box = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (k) => (box.has(k) ? box.get(k) : null),
      // 端末が保存を拒否している状態（事例 84 の SecurityError と同じ形）
      setItem: () => {
        throw new Error('保存できません')
      },
      removeItem: (k) => box.delete(k),
    },
  }
  return box
}

test('【実行】保存できない端末では、「あとで読む」が偽を返し、一覧も変わらない', async () => {
  withBrokenStorage()
  const saved = await import('../lib/saved-stories.ts?u15=toggle')
  const before = saved.savedStoryIds()
  const result = saved.toggleSavedStory('s0000001')
  assert.equal(result.kept, false, '残せていないのに、残せたと言っている')
  assert.deepEqual(saved.savedStoryIds(), before, '残っていないのに一覧が変わっている')
})

test('【実行】保存できない端末では、ヒアリングの書きかけも偽を返す', async () => {
  withBrokenStorage()
  const interview = await import('../lib/story-interview.ts?u15=draft')
  const kept = interview.saveInterviewDraft({ title: 'あ', body: 'い', hurdleText: '' })
  assert.equal(kept, false, '預けられていないのに、預けられたと言っている')
})

test('ヒアリングの終わりは、預けられないときに登録へ送らない', () => {
  const write = withoutComments(read('app/write/page.common.tsx'))
  const at = write.indexOf('const finishInterview')
  assert.notEqual(at, -1, 'ヒアリングの終わりが見つからない')
  const body = write.slice(at, at + 900)
  // 送るのは「預けられた」枝の中だけ
  assert.match(
    body,
    /saveInterviewDraft\([^)]*\)\s*\)\s*\{\s*router\.push\('\/signup\/'\)/,
    '預けられたか確かめずに登録へ送っている（書いた 4 行が消える）',
  )
  assert.match(body, /DEVICE_STORAGE_DRAFT_KEPT_ON_SCREEN/, '残っていることを言っていない')
})

test('「あとで読む」を押した側が、残せたかを受け取っている', () => {
  const button = withoutComments(read('components/save-story.tsx'))
  assert.match(button, /\{\s*kept\s*\}\s*=\s*toggleSavedStory\(/, '返り値を捨てている')
  assert.match(button, /DEVICE_STORAGE_SAVE_STORY_FAILED/, '残せなかったことを言っていない')
})

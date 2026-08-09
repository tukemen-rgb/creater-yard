/**
 * ビルド時に Story を読む口（designs 2026-08-09 03:22 段階 A-1）。
 *
 * 静的書き出し（`output: 'export'`）では、Story ごとの `<title>` や OGP を
 * 出すために **ビルドの時点で本文が要る**。`metadata` / `generateMetadata` は
 * Server Component でしか動かないので、画面側から `fetch` では間に合わない。
 * ここは **API を経由せず data/stories/ を直接読む**。
 *
 * 公開判定は自前で書かず `Stories.listAllPublic` / `getVisible` に任せる。
 * 静的側が自前で `visibility` を見ると、下書きを外す条件が API と静的の
 * 2 か所に分かれ、片方だけ直す事故が起きる（同 03:22 セキュリティ節）。
 *
 * ここで読むのは **ビルドを回した機械の data/**。API を別の機械で動かして
 * いるなら `CY_DATA_DIR` でその場所を指す（既定は `<cwd>/data`）。
 * data/ が無い機械では 0 件になる — 失敗ではなく「まだ何も無い」を出す。
 */
import fs from 'node:fs'
import path from 'node:path'

import { Stories } from '../server/lib/stories.mjs'
import type { Story } from './write-api'

function storiesDir(): string {
  const base = process.env.CY_DATA_DIR ?? path.join(process.cwd(), 'data')
  return path.join(base, 'stories')
}

/**
 * store を開く。無ければ null。
 *
 * `new Stories()` は保存側の都合でディレクトリを作るので、存在を先に見る。
 * ビルドしただけで空の data/stories/ が生えるのは、読むだけの側の振る舞い
 * として筋が悪い（書いていないのに書いた跡が残る）。
 */
function open(): Stories | null {
  const dir = storiesDir()
  if (!fs.existsSync(dir)) return null
  return new Stories({ dir })
}

/** 公開 Story の全件（新着順）。author / tag で絞れる。下書きは返らない。 */
export function readPublicStories({
  author = null,
  tag = null,
}: { author?: string | null; tag?: string | null } = {}): Story[] {
  return (open()?.listAllPublic({ author, tag }) ?? []) as Story[]
}

/**
 * 公開 Story を 1 件。下書き・存在しない id はどちらも null。
 * 閲覧者は居ない（ビルド時）ので `getVisible` の viewerId は渡さない
 * ＝ 本人でも下書きは焼き込まれない。
 */
export function readPublicStory(id: string): Story | null {
  return (open()?.getVisible(id) ?? null) as Story | null
}

/** 公開 Story を書いた人のハンドル（重複なし・辞書順）。/w/<handle>/ 用。 */
export function publicHandles(): string[] {
  return [...new Set(readPublicStories().map((story) => story.authorHandle))].sort()
}

/** 公開 Story に付いたタグ（2 軸を合わせた重複なしの一覧）。/tags/<tag>/ 用。 */
export function publicTags(): string[] {
  const vocabulary = open()?.publicTagVocabulary() ?? { tool: [], topic: [] }
  return [...new Set([...vocabulary.tool, ...vocabulary.topic])].sort()
}

/**
 * Story 画像の置き場。
 *
 * 実体（バイト列）とメタ（所有者・寸法）を分けて置く:
 *   <id>.<ext>   検査を通ったバイト列そのまま（再エンコードしない — image.mjs 参照）
 *   <id>.json    所有者・寸法・添付先。配信時には読まない
 *
 * ID は 12 バイトの乱数（base64url で 16 文字）。推測できない長さにして
 * いるのは、下書きに付けた画像も URL を知っていれば読めてしまうため。
 * 下書き本文と同じ強さで隠すなら配信にも認証が要るが、そうすると公開
 * Story の画像も毎回トークン検査を通ることになる。「本文は本人だけ・
 * 画像 URL は推測不能」という線で始め、需要が出たら考える。
 *
 * アップロードしたが Story に添付されないまま残った画像（孤児）は、
 * 一定時間で消す。書きかけでタブを閉じるのは普通の行動なので、失敗
 * ではなく想定内の掃除として扱う。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { ALLOWED_IMAGE_TYPES, ImageError, inspectImage } from './image.mjs'

const ID_RE = /^[A-Za-z0-9_-]{16}$/
const EXTS = new Set(Object.values(ALLOWED_IMAGE_TYPES).map((t) => t.ext))
/** 添付されないまま残った画像を消すまでの時間 */
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000
/** 1 人あたりの保持枚数。Story の上限（500 件）と揃えた書き潰し対策。 */
const MAX_PER_AUTHOR = 500

export { ImageError }

export class ImageStore {
  #dir

  constructor({ dir, now = () => Date.now() }) {
    this.#dir = dir
    this.now = now
    fs.mkdirSync(dir, { recursive: true })
  }

  #metaFile(id) {
    if (!ID_RE.test(id)) throw new ImageError('画像の ID が正しくありません。', 404)
    return path.join(this.#dir, `${id}.json`)
  }

  #bytesFile(id, ext) {
    if (!ID_RE.test(id) || !EXTS.has(ext)) {
      throw new ImageError('画像の ID が正しくありません。', 404)
    }
    return path.join(this.#dir, `${id}.${ext}`)
  }

  meta(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return null
    try {
      return JSON.parse(fs.readFileSync(this.#metaFile(id), 'utf8'))
    } catch {
      return null
    }
  }

  /** 配信用。メタは読まず、実体のパスと MIME を返す。 */
  filePath(id, ext) {
    const file = this.#bytesFile(id, ext)
    if (!fs.existsSync(file)) return null
    const type = Object.values(ALLOWED_IMAGE_TYPES).find((t) => t.ext === ext)
    return { file, mime: type.mime }
  }

  /**
   * 検査して保存する。通らなければ ImageError（理由つき）。
   * 保存した時点では孤児（storyId なし）。Story 側に添付されて初めて残る。
   */
  save(buf, { authorId, filename = '' }) {
    const count = this.#readAllMeta().filter((m) => m.authorId === authorId).length
    if (count >= MAX_PER_AUTHOR) {
      throw new ImageError(`保存できる画像は ${MAX_PER_AUTHOR} 枚までです。`, 403)
    }
    const info = inspectImage(buf, { filename })
    const id = crypto.randomBytes(12).toString('base64url')
    const meta = {
      id,
      authorId,
      ext: info.ext,
      width: info.width,
      height: info.height,
      bytes: info.bytes,
      storyId: null,
      createdAt: new Date(this.now()).toISOString(),
    }
    // 実体を先に置き、メタで完成にする。逆だと「メタはあるのに実体が無い」
    // という配信側から見えない壊れ方をする
    fs.writeFileSync(this.#bytesFile(id, info.ext), buf, { flag: 'wx' })
    fs.writeFileSync(this.#metaFile(id), JSON.stringify(meta, null, 2), { flag: 'wx' })
    this.pruneOrphans()
    return { ...meta, warnings: info.warnings }
  }

  /**
   * Story への添付。本人の画像しか付けられない。
   * 別の Story に付いている画像の使い回しも断る（Story を消したときに
   * 画像も消す、という約束が「どの Story のものか」で成り立っているため）。
   */
  attach(id, { authorId, storyId }) {
    const meta = this.meta(id)
    if (!meta) throw new ImageError('画像が見つかりません。アップロードし直してください。', 404)
    if (meta.authorId !== authorId) {
      throw new ImageError('この画像を使えるのは本人だけです。', 403)
    }
    if (meta.storyId && meta.storyId !== storyId) {
      throw new ImageError('この画像は別の Story に使われています。', 409)
    }
    meta.storyId = storyId
    fs.writeFileSync(this.#metaFile(id), JSON.stringify(meta, null, 2))
    return { id: meta.id, ext: meta.ext, width: meta.width, height: meta.height }
  }

  remove(id) {
    const meta = this.meta(id)
    if (!meta) return
    fs.rmSync(this.#bytesFile(id, meta.ext), { force: true })
    fs.rmSync(this.#metaFile(id), { force: true })
  }

  /** 退会時に全部消す（Story と同じ扱い — 記録は本人のもの）。 */
  removeByAuthor(authorId) {
    let removed = 0
    for (const meta of this.#readAllMeta()) {
      if (meta.authorId !== authorId) continue
      this.remove(meta.id)
      removed += 1
    }
    return removed
  }

  #readAllMeta() {
    let names
    try {
      names = fs.readdirSync(this.#dir)
    } catch {
      return []
    }
    const out = []
    for (const name of names) {
      if (!name.endsWith('.json') || name.endsWith('.tmp')) continue
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(this.#dir, name), 'utf8'))
        if (meta?.id && ID_RE.test(meta.id)) out.push(meta)
      } catch {
        /* 壊れた 1 件で全体を止めない */
      }
    }
    return out
  }

  /** 添付されないまま TTL を過ぎた画像を消す。 */
  pruneOrphans(now = this.now()) {
    let removed = 0
    for (const meta of this.#readAllMeta()) {
      if (meta.storyId) continue
      const created = Date.parse(meta.createdAt)
      if (Number.isFinite(created) && now - created > ORPHAN_TTL_MS) {
        this.remove(meta.id)
        removed += 1
      }
    }
    return removed
  }
}

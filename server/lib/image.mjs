/**
 * Story 画像の検査。GAMEYARD（server/lib/image.mjs）の流用。
 * 検査の中身は変えていない（検査を緩めない — CLAUDE.md）。変えたのは
 * 最小寸法だけ（下の IMAGE_LIMITS 参照）。
 *
 * 画像は新しい攻撃面である。テキストの検査を通しても、画像には別の面がある。
 *
 *   - **多重形式（polyglot）**: 正しい PNG の後ろに別のデータを繋げたファイル。
 *     画像として表示できるので見た目には気づけない。zip を繋げたものは
 *     ブラウザ以外の取り扱いで別の意味を持ち、スクリプトを繋げたものは
 *     配信設定のミス 1 つでスクリプトとして解釈される余地が生まれる。
 *   - **偽装**: 拡張子が .png で中身がまったく別のもの。
 *   - **展開爆弾**: 100,000 × 100,000 ピクセルのような宣言。デコードする側
 *     （ブラウザ）のメモリを食い潰す。ファイル自体は数 KB で済む。
 *   - **SVG**: 中身は XML で、script や外部参照を書ける。「画像」として
 *     受け取ってよいものではないので受け付けない。
 *
 * 依存を増やさずに済ませるため、寸法はコンテナを自分で読んで取る。
 * ライブラリに任せると、そのライブラリのデコーダに攻撃面が移るだけで、
 * ここで見たい「宣言と実体が合っているか」は結局自分で確かめることになる。
 *
 * 再エンコードはしない（そのためにデコーダを持ち込む方が危ない）。
 * つまり EXIF は残る。位置情報が含まれていれば検出して知らせる。
 */

export const IMAGE_LIMITS = {
  maxBytes: 3 * 1024 * 1024,
  // GAMEYARD のカバー（OGP 前提で 600×315 以上）と違い、Story の画像は
  // 制作途中のスクリーンショットが主役。ドット絵の画面写真（320×180 級）を
  // 弾くと「作りかけが主役」という文化と矛盾するので、下限だけ緩めた。
  // 上限（展開爆弾対策）は GAMEYARD と同じ。
  minWidth: 200,
  minHeight: 120,
  // デコード時のメモリは面積に比例する。4096×4096 で約 64MB（RGBA）。
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 4096 * 4096,
}

export const ALLOWED_IMAGE_TYPES = {
  png: { mime: 'image/png', ext: 'png' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  webp: { mime: 'image/webp', ext: 'webp' },
}

export class ImageError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ImageError'
    this.status = status
  }
}

// ---------------------------------------------------------------
// コンテナごとの読み取り
// ---------------------------------------------------------------

/**
 * PNG。IHDR から寸法を取り、**IEND で終わっている**ことを確かめる。
 * IEND の後ろにデータが続くファイルは多重形式を疑う。
 */
function readPng(buf) {
  if (buf.length < 24) throw new ImageError('PNG として短すぎます。')
  if (buf.readUInt32BE(12) !== 0x49484452) {
    // 先頭チャンクは必ず IHDR でなければならない（仕様）
    throw new ImageError('PNG の構造が壊れています（IHDR がありません）。')
  }
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)

  // チャンクを辿って IEND の位置を求める。長さを信用して飛ばすのではなく、
  // 範囲内に収まっているかを毎回確かめる（宣言長で範囲外を指させない）。
  let offset = 8
  let endsAt = -1
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.subarray(offset + 4, offset + 8).toString('latin1')
    const next = offset + 12 + length
    if (length > buf.length || next > buf.length) {
      throw new ImageError('PNG のチャンク長がファイルサイズと合いません。')
    }
    if (type === 'IEND') {
      endsAt = next
      break
    }
    offset = next
  }
  if (endsAt < 0) throw new ImageError('PNG が IEND で終わっていません。')
  return { format: 'png', width, height, endsAt }
}

/**
 * JPEG。SOF マーカーから寸法を取り、EOI（FFD9）で終わっていることを確かめる。
 * APP1（EXIF）の有無もここで拾う。
 */
function readJpeg(buf) {
  let offset = 2
  let width = 0
  let height = 0
  let exif = false
  let gps = false

  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      throw new ImageError('JPEG の構造が壊れています（マーカーが見つかりません）。')
    }
    const marker = buf[offset + 1]
    // スタンドアロンマーカー（長さを持たない）
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xd9) break // EOI
    const length = buf.readUInt16BE(offset + 2)
    if (length < 2 || offset + 2 + length > buf.length) {
      throw new ImageError('JPEG のセグメント長がファイルサイズと合いません。')
    }
    const segment = buf.subarray(offset + 4, offset + 2 + length)

    // SOF0..SOF15（DHT=C4, DAC=CC, DNL=C8 は除く）に寸法が入っている
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (segment.length < 5) throw new ImageError('JPEG の SOF セグメントが短すぎます。')
      height = segment.readUInt16BE(1)
      width = segment.readUInt16BE(3)
    }
    if (marker === 0xe1 && segment.subarray(0, 4).toString('latin1') === 'Exif') {
      exif = true
      // GPS IFD の存在を厳密に解くには IFD を辿る必要がある。ここでは
      // 位置情報が入っている可能性を伝えるだけなので、GPS タグ（0x8825）の
      // 出現で当たりを付ける。誤検知しても「確認してください」で済む扱いにする。
      for (let i = 0; i + 1 < segment.length; i += 2) {
        if (segment.readUInt16LE(i) === 0x8825 || segment.readUInt16BE(i) === 0x8825) {
          gps = true
          break
        }
      }
    }

    // SOS 以降は圧縮データなのでマーカー走査をやめる
    if (marker === 0xda) break
    offset += 2 + length
  }

  if (!width || !height) throw new ImageError('JPEG から寸法を読み取れませんでした。')
  // EOI で終わっているか。後ろに余分なデータがあれば多重形式を疑う。
  const endsAt = buf.length >= 2 && buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9
    ? buf.length
    : -1
  if (endsAt < 0) throw new ImageError('JPEG が EOI で終わっていません。')
  return { format: 'jpeg', width, height, endsAt, exif, gps }
}

/** WebP。RIFF のサイズ宣言がファイル長と一致することを確かめる。 */
function readWebp(buf) {
  if (buf.length < 30) throw new ImageError('WebP として短すぎます。')
  if (buf.subarray(8, 12).toString('latin1') !== 'WEBP') {
    throw new ImageError('WebP の構造が壊れています。')
  }
  const declared = buf.readUInt32LE(4) + 8
  if (declared !== buf.length) {
    throw new ImageError(
      `WebP の宣言サイズ（${declared} バイト）が実サイズ（${buf.length} バイト）と一致しません。`,
    )
  }
  const chunk = buf.subarray(12, 16).toString('latin1')
  let width = 0
  let height = 0
  if (chunk === 'VP8 ') {
    // ロッシー。フレームヘッダの後ろに 14 ビットずつ入っている
    width = buf.readUInt16LE(26) & 0x3fff
    height = buf.readUInt16LE(28) & 0x3fff
  } else if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    width = (bits & 0x3fff) + 1
    height = ((bits >> 14) & 0x3fff) + 1
  } else if (chunk === 'VP8X') {
    width = (buf.readUIntLE(24, 3) & 0xffffff) + 1
    height = (buf.readUIntLE(27, 3) & 0xffffff) + 1
  } else {
    throw new ImageError(`対応していない WebP の種類です（${chunk}）。`)
  }
  return { format: 'webp', width, height, endsAt: buf.length }
}

/**
 * 画像を検査する。通らないものは ImageError を投げる（理由つき）。
 *
 * @returns {{format: string, width: number, height: number, mime: string, ext: string, warnings: string[]}}
 */
export function inspectImage(buf, { filename = '' } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new ImageError('画像が空です。')
  }
  if (buf.length > IMAGE_LIMITS.maxBytes) {
    throw new ImageError(
      `画像のサイズが上限（${Math.floor(IMAGE_LIMITS.maxBytes / 1024 / 1024)}MB）を超えています。`,
    )
  }

  // 先頭バイトで種別を決める。拡張子は見ない（偽装できるため）。
  let info
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') {
    info = readPng(buf)
  } else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    info = readJpeg(buf)
  } else if (buf.subarray(0, 4).toString('latin1') === 'RIFF') {
    info = readWebp(buf)
  } else if (buf.subarray(0, 5).toString('latin1').trim().startsWith('<')) {
    // SVG や HTML。XML なので script も外部参照も書ける。
    throw new ImageError(
      'SVG・HTML は画像として受け付けていません（スクリプトや外部参照を書けるため）。PNG / JPEG / WebP を使用してください。',
    )
  } else {
    throw new ImageError('PNG / JPEG / WebP のいずれかを指定してください。')
  }

  // 末尾に余分なデータが付いていないか（多重形式の検出）
  if (info.endsAt > 0 && info.endsAt !== buf.length) {
    throw new ImageError(
      `画像データの終端（${info.endsAt} バイト）より後ろに ${buf.length - info.endsAt} バイトの` +
        'データが付いています。画像として正しく終わっているファイルを指定してください。',
    )
  }

  const { width, height } = info
  if (!width || !height) throw new ImageError('画像の寸法を読み取れませんでした。')
  if (width * height > IMAGE_LIMITS.maxPixels) {
    throw new ImageError(
      `画像が大きすぎます（${width}×${height}）。表示する側のメモリを圧迫するため、` +
        `${IMAGE_LIMITS.maxWidth}×${IMAGE_LIMITS.maxHeight} 以内にしてください。`,
    )
  }
  if (width > IMAGE_LIMITS.maxWidth || height > IMAGE_LIMITS.maxHeight) {
    throw new ImageError(
      `画像が大きすぎます（${width}×${height}）。${IMAGE_LIMITS.maxWidth}×${IMAGE_LIMITS.maxHeight} 以内にしてください。`,
    )
  }
  if (width < IMAGE_LIMITS.minWidth || height < IMAGE_LIMITS.minHeight) {
    throw new ImageError(
      `画像が小さすぎます（${width}×${height}）。` +
        `${IMAGE_LIMITS.minWidth}×${IMAGE_LIMITS.minHeight} 以上を指定してください。`,
    )
  }

  const warnings = []
  if (info.exif) {
    warnings.push(
      'EXIF（撮影情報）が含まれています。サイト側で再エンコードしないため、そのまま公開されます。',
    )
  }
  if (info.gps) {
    warnings.push(
      '位置情報らしきタグが含まれています。公開したくない情報が入っていないか確認してください。',
    )
  }
  // 拡張子と実体の食い違いは、危険ではないが投稿者の意図と違う可能性がある
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  const expected = ALLOWED_IMAGE_TYPES[info.format].ext
  if (ext && ext !== expected && !(info.format === 'jpeg' && ext === 'jpeg')) {
    warnings.push(`拡張子は .${ext} ですが、中身は ${info.format.toUpperCase()} です。`)
  }

  return {
    format: info.format,
    width,
    height,
    bytes: buf.length,
    mime: ALLOWED_IMAGE_TYPES[info.format].mime,
    ext: expected,
    warnings,
  }
}

#!/usr/bin/env node
/**
 * 開発・デモ用の中身を作る。空のサイトは画面の確認もデモもできない。
 *
 * **API を通す**（GAMEYARD の demo-seed と同じ方針）。ストアのファイルを
 * 直接書かない。直接書くと検査を通っていないものが「検査済み」の顔で並び、
 * デモで見せる画面と本番の経路が別物になる。
 *
 *   npm run api                      # 別ターミナルで API を立てておく
 *   node scripts/demo-seed.mjs
 *
 * 環境変数:
 *   DEMO_API                   API の場所（既定 http://127.0.0.1:8798）
 *   DEMO_SEED_ALLOW_REMOTE=1   localhost 以外の API を許す
 *
 * **既定では localhost にしか投げない。** 本番に向けて流すと、誰も書いて
 * いない Story が本番に並ぶ。中身はすべて架空（実在の個人・作品ではない）。
 */
import zlib from 'node:zlib'

const API = process.env.DEMO_API ?? 'http://127.0.0.1:8798'

{
  const host = new URL(API).hostname
  const local = host === '127.0.0.1' || host === 'localhost' || host === '::1'
  if (!local && process.env.DEMO_SEED_ALLOW_REMOTE !== '1') {
    console.error(`DEMO_API が localhost ではありません（${host}）。`)
    console.error('本番に流すつもりなら DEMO_SEED_ALLOW_REMOTE=1 を明示してください。')
    process.exit(1)
  }
}

/** デモ用の実 PNG（グラデーション）。ピクセルまで正規に作る。 */
function makePng(width, height, seed = 0) {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'latin1')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 0)
    return Buffer.concat([head, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // ビット深度
  ihdr[9] = 2 // RGB
  const rows = []
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 3] = ((x + seed * 40) * 255 / width) & 0xff
      row[2 + x * 3] = ((y + seed * 70) * 255 / height) & 0xff
      row[3 + x * 3] = 160 + seed * 20
    }
    rows.push(row)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(raw ? { 'content-type': 'image/png' } : body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${data?.error ?? '(本文なし)'}`)
  }
  return data
}

/** 全部架空。実在の個人・作品を模さない。 */
const WRITERS = [
  {
    handle: 'demo-hammer',
    stories: [
      {
        title: '当たり判定が斜めだけ抜ける',
        body: 'プレイヤーが斜めに走ると壁を抜ける。移動を X→Y の順に別々に解決していたのが原因で、フレームの間に角を跨いでいた。移動量を分割して 1 ステップずつ判定したら直った。\n\n同じところで詰まる人へ: 速度を上げたときだけ抜けるなら、まずトンネリングを疑ってください。',
        tools: ['Godot', 'Aseprite'],
        toolTags: ['godot'],
        topicTags: ['当たり判定', '物理'],
        image: 0,
      },
      {
        title: 'セーブデータの後方互換で悩んだ話',
        body: 'バージョン 0.2 でアイテム欄の形を変えたら、0.1 のセーブが読めなくなった。読み込み時にバージョン番号を見て 1 段ずつ変換する方式に変更。変換関数は消さずに積んでいく。',
        tools: ['Godot'],
        toolTags: ['godot'],
        topicTags: ['セーブデータ'],
      },
    ],
  },
  {
    handle: 'demo-koumori',
    stories: [
      {
        title: 'BGM のループ境界でノイズが乗る',
        body: 'ループ再生の境目で毎回プチッと鳴る。波形の切れ目がゼロクロスに合っていなかった。ループ端の数ミリ秒をフェードさせるより、そもそも切る位置をゼロクロスに合わせる方が確実だった。',
        tools: ['LMMS', 'Audacity'],
        toolTags: ['lmms', 'audacity'],
        topicTags: ['音', 'ループ'],
        image: 1,
      },
      {
        title: '（書きかけ）敵の思考ルーチンの整理',
        body: '',
        status: 'draft',
      },
    ],
  },
  {
    handle: 'demo-yorunuma',
    stories: [
      {
        title: 'AI と組んでドット絵の下書きを量産した',
        body: '構図出しは AI、清書は手作業に分けた。AI の出力をそのまま使うとタイルの継ぎ目が合わないので、下書きとして使って 16x16 に手で起こす。この分担にしてから 1 日 3 枚が 8 枚になった。使ったツールは隠さず書く。それがここの決まりなので。',
        tools: ['Claude', 'Aseprite'],
        toolTags: ['claude', 'aseprite'],
        topicTags: ['ドット絵', 'ワークフロー'],
        gameUrl: 'https://play-game-yard.com/games/demo-cave-crawl/',
      },
    ],
  },
]

const PASSWORD = 'demo-password-123'
let made = 0

for (const writer of WRITERS) {
  let token
  try {
    ;({ token } = await call('POST', '/api/auth/register', {
      body: { handle: writer.handle, password: PASSWORD },
    }))
    console.log(`登録: ${writer.handle}`)
  } catch {
    ;({ token } = await call('POST', '/api/auth/login', {
      body: { handle: writer.handle, password: PASSWORD },
    }))
    console.log(`既存: ${writer.handle}（ログインのみ）`)
  }
  for (const story of writer.stories) {
    let imageId
    if (story.image !== undefined) {
      const uploaded = await call('POST', '/api/story-image', {
        token,
        raw: makePng(800, 450, story.image),
      })
      imageId = uploaded.image.id
    }
    await call('POST', '/api/stories', {
      token,
      body: { ...story, image: undefined, imageId },
    })
    made += 1
    console.log(`  Story: ${story.title}`)
  }
}

console.log(`完了: Story ${made} 本（パスワードはすべて ${PASSWORD}）`)

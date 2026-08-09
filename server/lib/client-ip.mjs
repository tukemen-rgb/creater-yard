/**
 * 総当たり対策の「相手」を決める（designs 2026-08-09 23:45）。
 *
 * ## なぜ要るか
 *
 * 本番は nginx が `proxy_pass http://127.0.0.1:3010` で中継するので、
 * API から見た `req.socket.remoteAddress` は**常に `127.0.0.1`**。
 * これをそのまま鍵にすると、IP 単位のバックオフが**全利用者で 1 つ**に
 * なり、誰かが数回わざと失敗させるだけで**全員がログインできなくなる**。
 *
 * ## なぜ「既定では信じない」か
 *
 * 転送ヘッダは**相手が自由に名乗れる**。API を直接叩ける相手が
 * `X-Real-IP: 1.2.3.4` と名乗れば、他人の IP を騙ってバックオフを
 * 撃ち込める（＝狙った相手を締め出せる）し、毎回違う値を名乗れば
 * バックオフを素通りできる。
 *
 * だから **`header` を渡されたときだけ**読む。渡されない構成
 * （開発・単体試験・API を直接公開する構成）では socket を使う。
 *
 * ## 渡す側の責任
 *
 * ヘッダを信じる構成にするなら、**逆プロキシが必ず上書きする**こと。
 * nginx なら `proxy_set_header X-Real-IP $remote_addr;` を必ず書く
 * （書かないと client が付けた値がそのまま通る）。
 * Cloudflare のうしろに置く場合は、`$remote_addr` 自体を
 * `set_real_ip_from` ＋ `real_ip_header CF-Connecting-IP` で
 * 訪問者の IP に直してから渡す（docs/nginx.example.conf）。
 */

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {string | null | undefined} header 信じるヘッダ名。無ければ socket を使う
 * @returns {string}
 */
export function clientKey(req, header) {
  const name = String(header ?? '').trim().toLowerCase()
  if (name) {
    const raw = req.headers?.[name]
    // 同じヘッダが複数回来ると node は配列にする。X-Forwarded-For のように
    // カンマで連なる形もあるので、どちらでも先頭を取る
    const first = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim()
    if (first) return first
    // 信じる設定なのにヘッダが無い＝逆プロキシを経ていない要求。
    // socket へ落として、鍵が空になる（＝全員が同じ鍵になる）のを避ける
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

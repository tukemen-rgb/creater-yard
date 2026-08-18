#!/bin/bash
#
# 公開されている素材が、いま置いたものと同じかを確かめる。
#
# 2026-08-16 の配備は全部緑のまま「動画だけ古い」を通した。apply-latest.sh の
# 最終確認が見ていたのは**公開 CSP と公開 HTML の見出しだけ**で、
# **動画は HTML ではない**ためすり抜けた（docs/research/case-studies.md 64）。
#
# public/media/ の素材は素の名前（hero.mp4 など）なので、差し替えても URL が
# 変わらず、CDN や proxy は古い複製を配り続ける。MDN いわく「長い max-age で
# 中間サーバーに置かれた応答は消しに行けない」。**配られているものが置いた
# ものと同じかは、公開側を引かないと分からない。**
#
# 中身は落とさず content-length だけ比べる（毎回 7MB を取りに行かない）。
#
# 使い方:
#   deploy/verify-public-assets.sh
#   ORIGIN=https://example.test MEDIA_DIR=/path/to/media deploy/verify-public-assets.sh
#
# 終了コード:
#   0 … 一致（または比べる素材が無い・比べられないものがあっただけ）
#   2 … 不一致あり。**配備の失敗ではない**ので、呼び出し側は 1 と区別すること
#
# 判定は 3 状態:「一致」「不一致」「比べられない」。2 状態しか持たない検査は、
# **分からないことを悪いことにしてしまう**（④ 03:10 の指摘・設計 O-3）。
set -uo pipefail

ORIGIN="${ORIGIN:-https://creatoryard.io}"
MEDIA_DIR="${MEDIA_DIR:-/opt/creatoryard/public/media}"

if [ ! -d "$MEDIA_DIR" ]; then
  echo "公開素材  : 確認しません（$MEDIA_DIR がありません）"
  exit 0
fi

mismatch=0
matched=0
unknown=0

# 公開側の長さを 1 つ決める。**上から順に見て、決まったところで止める。**
#
# 1. content-length（ただし content-encoding が無いときだけ）
#    —— 圧縮されていると、これは**圧縮後の長さ**なので手元とは一致しない
#      （RFC 9110 §8.6「transferring a representation as content, Content-Length
#       refers specifically to the amount of data enclosed」）
# 2. ETag の後半
#    —— nginx は `"<mtime の 16 進>-<サイズの 16 進>"` を返し、**圧縮されても
#      後半は圧縮前の長さのまま**（本番で実測。CF が圧縮すると W/ が付くだけ）。
#      **ただしこれは nginx の慣習であって仕様ではない。**RFC 9110 §8.8.3 は
#      ETag を opaque validator（中身を解釈してはならない不透明な値）と定める。
#      だから**読めたら使う、読めなければ諦める**以上のことはしない
# 3. どちらでも決まらなければ「比べられない」
#    —— **content-length は MAY である**（RFC 9110 §8.6: HEAD 応答では
#      「A server MAY send a Content-Length header field」）。無いのは異常では
#      ない。**分からないことを、悪いことと同じ顔で出さない**
public_size_of() {
  headers=$1
  cl=$(printf '%s' "$headers" | sed -n 's/^[Cc]ontent-[Ll]ength: //p' | head -1)
  ce=$(printf '%s' "$headers" | sed -n 's/^[Cc]ontent-[Ee]ncoding: //p' | head -1)
  if [ -n "$cl" ] && [ -z "$ce" ]; then
    printf '%s' "$cl"
    return 0
  fi
  etag=$(printf '%s' "$headers" | sed -n 's/^[Ee][Tt]ag: //p' | head -1)
  etag=${etag#W/}
  etag=${etag#\"}
  etag=${etag%\"}
  case "$etag" in
    *-*)
      hex=${etag##*-}
      case "$hex" in
        *[!0-9a-fA-F]*|'') return 1 ;;
      esac
      printf '%d' "0x$hex" 2>/dev/null && return 0
      return 1
      ;;
  esac
  return 1
}

for f in "$MEDIA_DIR"/*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  case "$name" in
    *.md|RIGHTS_APPROVED) continue ;;   # 配布物ではない
  esac
  local_size=$(wc -c < "$f" | tr -d ' ')
  headers=$(
    curl --silent --show-error --max-time 20 --head \
      -H 'Accept-Encoding: identity' "$ORIGIN/media/$name" 2>/dev/null |
      tr -d '\r'
  )
  # **応答そのものが返っていないなら「比べられない」ではなく「未反映」。**
  # 404 は「分からない」ではなく「配られていない」——3 状態にしたとき、
  # 既存の試験がここを教えてくれた（設計 O-3 が落としていた分岐）。
  status=$(printf '%s' "$headers" | sed -n 's|^HTTP/[0-9.]* \([0-9]*\).*|\1|p' | tail -1)
  case "${status:-000}" in
    2*) ;;
    *)
      mismatch=$((mismatch + 1))
      printf '公開素材  : 未反映 %s（公開されていません: HTTP %s）\n' "$name" "${status:-応答なし}"
      continue
      ;;
  esac
  if public_size=$(public_size_of "$headers"); then
    if [ "$public_size" = "$local_size" ]; then
      matched=$((matched + 1))
    else
      mismatch=$((mismatch + 1))
      printf '公開素材  : 未反映 %s（公開 %s / 手元 %s）\n' "$name" "$public_size" "$local_size"
    fi
  else
    unknown=$((unknown + 1))
    printf '公開素材  : 比べられません %s（長さも ETag も読めません）\n' "$name"
  fi
done

# **まとめの行には必ず分母を書く**（規則 20 の条項・⑤ 2026-08-17 の裁定 2）。
# 「OK」とだけ書けるのは、**分母と分子が一致しているとき**だけ。
# ④が見つけた: 2 件のうち 1 件しか比べていないのに「OK（1 件が手元と一致）」で
# 終わっていた。配備の出力は長いので、読み手は最後の行だけを見る。
total=$((matched + mismatch + unknown))
if [ "$mismatch" -eq 0 ] && [ "$unknown" -eq 0 ]; then
  printf '公開素材  : OK（全 %s 件のうち %s 件が手元と一致）\n' "$total" "$matched"
  exit 0
fi
if [ "$mismatch" -eq 0 ]; then
  # **「比べられない」は異常ではないので 0 で返す。だが「OK」とは書かない。**
  printf '公開素材  : 全 %s 件のうち 一致 %s / 比べられない %s（不一致は 0）\n' \
    "$total" "$matched" "$unknown"
  exit 0
fi

# **配備の失敗ではない。**古いのは CDN の複製なので、ここで 1 を返すと
# 「配備が壊れた」と誤読され、不要な切り戻しを招く。2 で区別する。
printf '公開素材  : 全 %s 件のうち 一致 %s / 不一致 %s / 比べられない %s\n' \
  "$total" "$matched" "$mismatch" "$unknown"
echo "公開素材  : 上記が古いまま配られています。配備そのものは成功しています。"
echo "            CDN に複製が残っているだけなので、次のどちらかで直ります:"
echo "            (1) Cloudflare の Purge Cache で該当 URL を消す"
echo "            (2) そのまま待つ（寿命が切れれば入れ替わる）"
exit 2

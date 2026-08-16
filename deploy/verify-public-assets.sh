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
#   0 … 一致（または比べる素材が無い）
#   2 … 不一致あり。**配備の失敗ではない**ので、呼び出し側は 1 と区別すること
set -uo pipefail

ORIGIN="${ORIGIN:-https://creatoryard.io}"
MEDIA_DIR="${MEDIA_DIR:-/opt/creatoryard/public/media}"

if [ ! -d "$MEDIA_DIR" ]; then
  echo "公開素材  : 確認しません（$MEDIA_DIR がありません）"
  exit 0
fi

mismatch=0
checked=0
for f in "$MEDIA_DIR"/*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  case "$name" in
    *.md|RIGHTS_APPROVED) continue ;;   # 配布物ではない
  esac
  local_size=$(wc -c < "$f" | tr -d ' ')
  public_size=$(
    curl --silent --show-error --max-time 20 --head "$ORIGIN/media/$name" 2>/dev/null |
      tr -d '\r' |
      sed -n 's/^[Cc]ontent-[Ll]ength: //p' |
      head -1
  )
  checked=$((checked + 1))
  if [ "$public_size" != "$local_size" ]; then
    mismatch=$((mismatch + 1))
    printf '公開素材  : 未反映 %s（公開 %s / 手元 %s）\n' \
      "$name" "${public_size:-取得できず}" "$local_size"
  fi
done

if [ "$mismatch" -eq 0 ]; then
  printf '公開素材  : OK（%s 件が手元と一致）\n' "$checked"
  exit 0
fi

# **配備の失敗ではない。**古いのは CDN の複製なので、ここで 1 を返すと
# 「配備が壊れた」と誤読され、不要な切り戻しを招く。2 で区別する。
echo "公開素材  : 上記が古いまま配られています。配備そのものは成功しています。"
echo "            CDN に複製が残っているだけなので、次のどちらかで直ります:"
echo "            (1) Cloudflare の Purge Cache で該当 URL を消す"
echo "            (2) そのまま待つ（寿命が切れれば入れ替わる）"
exit 2

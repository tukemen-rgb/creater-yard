#!/bin/sh
# 本番へ最新 main を反映する 1 コマンド。スマホなど長い貼り付けが
# つらい環境から、これだけで事前検査＋ビルド＋CSP修正＋配置＋再起動が終わる:
#
#   cd /opt/creatoryard && git switch main && git pull --ff-only origin main && sh deploy/apply-latest.sh
#
# CSP は構文検査に失敗したら元へ戻す。両ビルドが成功するまでは
# nginx・公開静的ファイル・実行中サービスを変更しない。
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "root 権限で実行してください" >&2
  exit 1
fi

cd /opt/creatoryard
if [ "$(git branch --show-current)" != "main" ]; then
  echo "main ブランチではありません。反映を中止します" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "未コミット変更があります。反映を中止します" >&2
  exit 1
fi

echo "== 1/3 事前ビルド =="
# 配るものの中へ「どの commit から作ったか」を 1 枚置く（設計 O-6）。
# 2026-08-19、本番が main から 3 日ぶん遅れているのに死活確認は 3 日間ずっと
# 緑だった。見ているのが「応答するか」だけで、**版を見ていなかった**ため。
#
# **ビルドより前**に書く。public/ の中身は out/ にも next start にも
# そのまま乗るので、書いてからビルドしないと配るものに入らない。
# 中身は commit の SHA 1 行だけ。日時も枝名も入れない（増やすほど、
# それが正しいことを別に保証する羽目になる）。
# .gitignore に入っているので、上の git status --porcelain は空のまま。
git rev-parse HEAD > public/build.txt
echo "  版: $(cat public/build.txt)"

# 同居機（GAMEYARD と同じ VPS）なのでメモリ上限つき
export NODE_OPTIONS=--max-old-space-size=1024
npm ci
npm run build
npm run build:server

echo "== 2/3 CSP・配置・再起動 =="
# Next.js の静的書き出しはインライン初期化 script を使うため、
# script-src 'self' だけだと描画直後に画面が消える（PR #6 と同じ修正。
# script-src-attr 'none' で onclick 等のイベント属性は禁止のまま）
CHANGED_LIST=$(mktemp)
trap 'rm -f "$CHANGED_LIST"' EXIT HUP INT TERM
NGINX_SITE=/etc/nginx/sites-available/creatoryard
if [ ! -f "$NGINX_SITE" ]; then
  echo "$NGINX_SITE がありません。反映を中止します" >&2
  exit 1
fi

printf '%s\n' "$NGINX_SITE" | while IFS= read -r f; do
  [ -n "$f" ] || continue
  if grep -q "script-src 'self';" "$f"; then
    cp -p "$f" "$f.bak-csp"
    printf '%s\n' "$f" >> "$CHANGED_LIST"
    sed -i "s|script-src 'self';|script-src 'self' 'unsafe-inline'; script-src-attr 'none';|" "$f"
    echo "  直した: $f（元は $f.bak-csp）"
  fi
done

if [ -s "$CHANGED_LIST" ]; then
  if nginx -t; then
    if ! systemctl reload nginx; then
      echo "nginx reload失敗。CSP変更を元へ戻します" >&2
      while IFS= read -r f; do
        cp -p "$f.bak-csp" "$f"
      done < "$CHANGED_LIST"
      nginx -t
      systemctl reload nginx || true
      exit 1
    fi
  else
    echo "nginx 構文検査失敗。CSP変更を元へ戻します" >&2
    while IFS= read -r f; do
      cp -p "$f.bak-csp" "$f"
    done < "$CHANGED_LIST"
    nginx -t
    exit 1
  fi
else
  echo "  CSPは修正済みか対象なし。変更なし"
fi

mkdir -p /var/www/creatoryard/static
rsync -a --delete out/ /var/www/creatoryard/static/
mkdir -p .next-server/cache
chown -R creatoryard:creatoryard .next-server/cache
systemctl restart creatoryard-api creatoryard-web

echo "== 3/3 確認 =="
sleep 2
# **港を書き写さない。**この repo には web の港が 4 か所ある（この行・
# creatoryard-web.service の -p・nginx の upstream・healthcheck.sh の既定）。
# 2026-08-20 に数えたら、**ここだけ 3001 で、ほかの 3 か所は 3000 だった。**
# どちらが本番かは、この repo からは決められない（GO-LIVE には GAMEYARD と
# 同居していれば 3001 へ移す、と書いてある）。
#
# **勝手に決めない。**死活確認と同じ変数を見て、無ければ従来どおり 3001 を
# 使う（いままでの振る舞いを変えない）。**使った先を必ず出す**ので、
# 違っていればその場で分かる。
WEB_CHECK="${HEALTH_WEB:-http://127.0.0.1:3001}"
printf 'web(%s): ' "$WEB_CHECK"
curl --fail --silent --show-error -o /dev/null -w '%{http_code}\n' "$WEB_CHECK/"
API_CHECK="${HEALTH_API:-http://127.0.0.1:8798}"
printf 'api(%s): ' "$API_CHECK"
curl --fail --silent --show-error -o /dev/null -w '%{http_code}\n' "$API_CHECK/api/health"
printf '設定CSP  : '
grep -o "script-src [^;]*" "$NGINX_SITE" | head -1

# 設定ファイルではなく、Cloudflare経由の公開レスポンスまで反映されたことを確認する。
# reload直後の一時差を許容し、最大30秒だけ再試行する。
PUBLIC_CSP=
attempt=1
while [ "$attempt" -le 6 ]; do
  PUBLIC_CSP=$(
    curl --fail --silent --show-error --head https://creatoryard.io/ 2>/dev/null |
      tr -d '\r' |
      sed -n 's/^content-security-policy: //p' |
      head -1
  ) || true
  case "$PUBLIC_CSP" in
    *"script-src 'self' 'unsafe-inline'"*"script-src-attr 'none'"*)
      break
      ;;
  esac
  sleep 5
  attempt=$((attempt + 1))
done

case "$PUBLIC_CSP" in
  *"script-src 'self' 'unsafe-inline'"*"script-src-attr 'none'"*)
    printf '公開CSP  : %s\n' "$PUBLIC_CSP"
    ;;
  *)
    echo "公開レスポンスのCSPが未反映です: $PUBLIC_CSP" >&2
    exit 1
    ;;
esac

if ! curl --fail --silent --show-error https://creatoryard.io/ |
  grep -q 'つくる過程に、'; then
  echo "公開ホームの本文を確認できません" >&2
  exit 1
fi
echo "公開本文  : OK（見出しを確認）"

# 公開されている素材が、いま置いたものと同じか（deploy/verify-public-assets.sh）。
# **不一致でも配備は止めない。**古いのは CDN の複製で、配備そのものは
# 成功しているため（終了コード 2 で区別している）。
sh /opt/creatoryard/deploy/verify-public-assets.sh || true

echo "終わり。ブラウザで https://creatoryard.io/ を再読み込みして確認"

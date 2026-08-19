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

# **ビルドの前に、本番の設定を読む。**
#
# systemd の `EnvironmentFile=` は**動いているサービス**にしか効かない。
# ところが**静的に書き出す面はビルド時に env を読む** —— `CY_SITE_ORIGIN`
# （canonical と og:url）と `CY_CONTACT_EMAIL`（`/data-policy/` の連絡先）である。
# ここで読まないと、**その 2 つが静的な面からだけ抜ける。**
#
# **2026-08-20 に本番で確かめた形**:
#
#   /          canonical 無し   ← 静的に書き出した面（ビルド時に env が無かった）
#   /stories/  canonical 有り   ← server が描く面（unit の EnvironmentFile が効く）
#
# 両方とも同じ `absoluteUrl()` を呼んでいるので、**差はビルド時の env にしかない。**
# `CY_CONTACT_EMAIL` も同じ理由で、設定ファイルに書いても連絡先の節が出ない。
#
# 読めなくても**止めない** —— 反映そのものを妨げるほうが害が大きい。
# ただし**何が抜けるかを名指しで言う**（黙って続けたのが、この不具合の元）。
CY_ENV_FILE="${CY_ENV_FILE:-/etc/creatoryard/creatoryard.env}"
if [ -r "$CY_ENV_FILE" ]; then
  set -a
  . "$CY_ENV_FILE"
  set +a
  echo "  設定を読みました: $CY_ENV_FILE"
else
  echo "  設定を読めません: $CY_ENV_FILE" >&2
  echo "  静的な面に canonical・og:url・連絡先が入りません（CY_ENV_FILE で場所を変えられます）" >&2
fi

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
# **勝手に決めない。使った先を必ず出す**ので、違っていればその場で分かる。
# HEALTH_WEB があればそれだけを見る（運用者が決めた先）。無いときは、
# **この repo に在る港を順に当てて、答えたほうを使う。**
# **どちらが本番かを、この repo から決めないため。**どれも答えなければ
# 従来どおり失敗する —— web が落ちているのは、隠さず失敗するべきこと。
if [ -n "${HEALTH_WEB:-}" ]; then
  WEB_CANDIDATES="$HEALTH_WEB"
else
  WEB_CANDIDATES="http://127.0.0.1:3001 http://127.0.0.1:3000"
fi
WEB_CHECK=
for candidate in $WEB_CANDIDATES; do
  if curl --fail --silent -o /dev/null --max-time 5 "$candidate/"; then
    WEB_CHECK="$candidate"
    break
  fi
done
if [ -z "$WEB_CHECK" ]; then
  echo "web がどの港でも答えません（試した先: $WEB_CANDIDATES）" >&2
  exit 1
fi
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

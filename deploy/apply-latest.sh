#!/bin/sh
# 本番へ最新 main を反映する 1 コマンド。スマホなど長い貼り付けが
# つらい環境から、これだけで CSP 修正＋ビルド＋配置＋再起動が終わる:
#
#   cd /opt/creatoryard && git pull && sh deploy/apply-latest.sh
#
# 何度実行しても安全な形にしてある（直っていれば何もしない・
# nginx は構文検査に通ったときだけ reload）。
set -eu

echo "== 1/3 CSP =="
# Next.js の静的書き出しはインライン初期化 script を使うため、
# script-src 'self' だけだと描画直後に画面が消える（PR #6 と同じ修正。
# script-src-attr 'none' で onclick 等のイベント属性は禁止のまま）
FIXED=0
for f in $(grep -rl "Content-Security-Policy" /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null); do
  if grep -q "script-src 'self';" "$f"; then
    cp "$f" "$f.bak-csp"
    sed -i "s|script-src 'self';|script-src 'self' 'unsafe-inline'; script-src-attr 'none';|" "$f"
    echo "  直した: $f（元は $f.bak-csp）"
    FIXED=1
  fi
done
if [ "$FIXED" = 1 ]; then
  nginx -t
  systemctl reload nginx
else
  echo "  修正済みか対象なし。何もしない"
fi

echo "== 2/3 ビルドと配置 =="
cd /opt/creatoryard
# 同居機（GAMEYARD と同じ VPS）なのでメモリ上限つき
export NODE_OPTIONS=--max-old-space-size=1024
npm run build
mkdir -p /var/www/creatoryard
rsync -a --delete out/ /var/www/creatoryard/static/
npm run build:server
mkdir -p .next-server/cache
chown -R creatoryard:creatoryard .next-server/cache 2>/dev/null || true
systemctl restart creatoryard-web

echo "== 3/3 確認 =="
sleep 2
printf 'web(3001): ' && curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/
printf 'api      : ' && curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8798/api/health
printf 'CSP      : ' && grep -rho "script-src [^;]*" /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null | head -1
echo "終わり。ブラウザで https://creatoryard.io/ を再読み込みして確認"

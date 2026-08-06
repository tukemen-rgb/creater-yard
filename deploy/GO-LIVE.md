<!-- 本番公開の手順書。Claude は「公開の 1 手前」まで整える。最後の公開操作は人。 -->
# CreatorYard 本番公開の手順（Go-Live Runbook）

GAMEYARD の GO-LIVE.md と同じ考え方で書いた、**サーバーに載せてネットで
触れるようにする**ための人の作業手順。ドメインが決まれば、この文書の
`creatoryard.example` を実ドメインに置き換えて上から実行するだけで公開できる。

## 0. 全体像

本番は **1 台に 2 つの Node プロセス＋nginx**。GAMEYARD より 1 つ少ない
（検査エンジン clamd と別オリジン配信 game-host が無いため）。

| プロセス | 役目 | 待受 | ユニット |
| --- | --- | --- | --- |
| api | アカウント・Story・画像の受付と配信 | 127.0.0.1:8798 | `creatoryard-api.service` |
| web | Story ページを組み立てる Next.js | 127.0.0.1:3000 | `creatoryard-web.service` |
| nginx | 静的配信＋振り分け＋TLS | 443 | `deploy/nginx.conf.example` |

固定ページ（トップ・ログイン等）は静的ファイル、Story 系（`/story/`
`/creators/` `/stories/` `/tags/`）と `/api/` は動的（nginx が振り分ける）。

## 1. 先に用意するもの（人）

- [ ] **サーバー** 1 台（Ubuntu 24.04 想定。GAMEYARD と同居も可 — 下の§6）
- [ ] **ドメイン 1 つ**（決定待ち: creatoryard.io / .jp / .net）。
      画像を GAMEYARD と同じ別オリジン配信に揃えるなら **+1 ドメイン**
      （Issue #1 の判断材料。揃えない判断なら不要）
- [ ] DNS A/AAAA をサーバーへ向ける
- [ ] `node`（v22 系）・`nginx`・`certbot` を導入

## 2. 人が決める値（`/etc/creatoryard/creatoryard.env`）

`deploy/creatoryard.env.example` をコピーして埋める。

- [ ] `CY_SITE_ORIGIN` … 決まった本番ドメイン（https:// から書く）
- [ ] `AUTH_SECRET` … `openssl rand -base64 48` の出力
- [ ] `MAIL_*` … パスワード再設定を有効にする場合（GAMEYARD と同じ
      Gmail SMTP のアプリパスワードが流用できる）。未設定でも公開は
      できる — 再設定 API が「使えない」と答えるだけ
- [ ] `CY_ADMIN_HANDLES` … 運営のハンドル。公開後に通常の登録で
      アカウントを作り（例: sidra_studio）、そのハンドルをここに書く。
      通報は `/admin/reports/` で確認できる

権限: `chown root:creatoryard` / `chmod 640`。

## 3. 配置

```sh
# 実行ユーザー
useradd --system --home /opt/creatoryard --shell /usr/sbin/nologin creatoryard

# コード
git clone https://github.com/tukemen-rgb/creater-yard /opt/creatoryard
cd /opt/creatoryard && npm ci

# 実データの置き場（API が書く唯一の場所）
mkdir -p /var/lib/creatoryard/store
chown -R creatoryard:creatoryard /var/lib/creatoryard

# 静的書き出し
npm run build                      # out/ ができる
mkdir -p /var/www/creatoryard
rsync -a --delete out/ /var/www/creatoryard/static/

# server モードのビルド（web プロセスが使う）
SITE_MODE=server npm run build

# systemd
cp deploy/creatoryard-{api,web,backup,healthcheck}.service \
   deploy/creatoryard-{backup,healthcheck}.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now creatoryard-api creatoryard-web \
   creatoryard-backup.timer creatoryard-healthcheck.timer
```

## 4. nginx と TLS

```sh
certbot certonly --nginx -d creatoryard.example
# deploy/nginx.conf.example の creatoryard.example を実ドメインに置換して
# /etc/nginx/sites-available/creatoryard に置き、有効化
nginx -t && systemctl reload nginx
```

## 5. 公開後の確認（上から順に）

- [ ] `https://<ドメイン>/` … トップが出る（静的）
- [ ] `https://<ドメイン>/api/health` … `{"ok":true}`
- [ ] 新規登録 → Story 公開 → `/story/<id>/` が **HTML に本文入り**で出る
- [ ] 画像を付けて公開 → 表示される
- [ ] `https://<ドメイン>/sitemap-stories.xml` … URL が並ぶ
      （`CY_SITE_ORIGIN` 未設定だと 404 のまま — 設定を確認）
- [ ] `/var/www/creatoryard/static/robots.txt` に Sitemap 行を足す:
      `Sitemap: https://<ドメイン>/sitemap-stories.xml`
- [ ] Search Console にドメインを登録し sitemap を出す（タグ SEO の起点）
- [ ] `deploy/backup.sh` を手で 1 回実行し、復元訓練 OK のログを見る

## 6. GAMEYARD と同居させる場合

ポートは衝突しない（GAMEYARD: 8787/3000/8788、CreatorYard: 8798/3000）
**…が web の 3000 だけ衝突する**。CreatorYard 側を 3001 にする:
`creatoryard-web.service` の `-p 3000` を `-p 3001` に、nginx の
upstream も合わせる。メモリは GAMEYARD の clamd ピーク（~1.9GB）に
CreatorYard の 2 プロセス（~600MB）が乗るので、**4GB 機なら同居可、
余裕を見るなら別 VPS**（社長の判断）。

## 7. 切り戻し

- コードの問題: `git -C /opt/creatoryard checkout <前のタグ>` →
  `npm ci` → 両ビルド → `systemctl restart creatoryard-api creatoryard-web`
- データの問題: `systemctl stop creatoryard-api` →
  `/var/backups/creatoryard/` の tar.gz を `/var/lib/creatoryard/` に展開 →
  起動。**manifest の件数と展開後の件数を必ず照合する**

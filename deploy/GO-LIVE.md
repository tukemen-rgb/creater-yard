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
#
# **`SITE_MODE=server npm run build` では駄目。**`npm run build` は
# `scripts/build.mjs static` を呼び、build.mjs が**引数の static で
# SITE_MODE を上書きする**ので、外から env を付けても static ビルドに
# なる（2026-08-14 の本番設置で実際に踏んだ。.next-server ができず、
# web プロセスが activating を繰り返した）。専用スクリプトを使う:
npm run build:server

# web プロセスが実行時に書く場所を、実行ユーザーの持ち物にする
# （unit の ProtectSystem=strict は ReadWritePaths を開けるだけで、
#  ファイルの所有者までは変えないため）
mkdir -p .next-server/cache
chown -R creatoryard:creatoryard .next-server/cache

# systemd
cp deploy/creatoryard-{api,web,backup,healthcheck}.service \
   deploy/creatoryard-{backup,healthcheck}.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now creatoryard-api creatoryard-web \
   creatoryard-backup.timer creatoryard-healthcheck.timer
```

## 4. nginx と TLS

**順番に意味がある: 証明書が先、設定の有効化が後。**
`nginx.conf.example` は `/etc/letsencrypt/live/<ドメイン>/` の証明書を参照する
ので、**取得前に有効化すると `nginx -t` が「証明書が無い」で落ちる**
（2026-08-14 の本番設置で実際に踏んだ。設定を sites-enabled から外す →
certbot → 戻す、で復旧した）。Cloudflare を使う場合は、**取得が終わるまで
DNS only（灰色雲）**にしておく（HTTP-01 は 80 番へ直接届く必要がある）。

```sh
certbot certonly --nginx -d creatoryard.example
# deploy/nginx.conf.example の creatoryard.example を実ドメインに置換して
# /etc/nginx/sites-available/creatoryard に置き、有効化
nginx -t && systemctl reload nginx
```

**Cloudflare の IP 範囲を取り直す**（`set_real_ip_from` の行）。
入れっぱなしにしない —— Cloudflare は範囲を足すことがある。
足された範囲が抜けていると、**その範囲を通った訪問者だけ IP を取り戻せず、
まとめて 1 枠**になる（流量制限とログインのバックオフが効かない）。

```sh
curl -s https://www.cloudflare.com/ips-v4
curl -s https://www.cloudflare.com/ips-v6   # ← v6 も必ず取る
# 出た範囲を deploy/nginx.conf.example の set_real_ip_from と突き合わせ、
# 増えていたら足す。ファイル上部の「取得日」も更新する
```

**v4 と v6 の両方を取り直すこと。**`listen 443` と `listen [::]:443` の
両方で待ち受けているので、**片方だけ新しくすると、古いほうの脚で同じ穴が開く。**

**origin に AAAA レコードを向けるなら、v6 の範囲が入っていることを先に確かめる。**
入っていないまま AAAA を公開すると、**IPv6 で来た訪問者は全員 1 枠**になり、
1 人がログインを失敗させるだけで**その脚の全員が締め出される。**

**取り戻せているかの確認**（訪問者の IP になっているか）:

```sh
# 公開後、別回線のスマホなどから 1 回アクセスしてから
tail -n 5 /var/log/nginx/access.log
# 先頭の IP が Cloudflare の範囲（104.16.x など）のままなら、
# 取り戻せていない。set_real_ip_from を確認する
```

## 5. 公開後の確認（上から順に）

- [ ] `https://<ドメイン>/` … **実ブラウザで**見出しと「Story を読む」
      「書き始める」が出る（HTML の取得だけでは初期化失敗を検出できない）
- [ ] ブラウザの Console に CSP 違反や `Connection closed` が出ていない
- [ ] `https://<ドメイン>/api/health` … `{"ok":true}`
- [ ] `https://<ドメイン>/build.txt` … **いま配られているものが、どの commit
      から作られたか**（設計 O-6）。`git rev-parse HEAD` と突き合わせる:

      ```
      curl -s https://<ドメイン>/build.txt; git -C /opt/creatoryard rev-parse HEAD
      ```

      **同じでなければ、反映が途中で止まっている。**死活確認も同じことを
      見ていて、ずれていれば NG を出す。なお「手元が main より古い」は
      **注記だけで NG にしない**（反映するかは人が決めること）
- [ ] 新規登録 → Story 公開 → `/story/<id>/` が **HTML に本文入り**で出る
- [ ] 画像を付けて公開 → 表示される
- [ ] `https://<ドメイン>/sitemap-stories.xml` … URL が並ぶ
      （`CY_SITE_ORIGIN` 未設定だと 404 のまま — 設定を確認）
- [ ] `/var/www/creatoryard/static/robots.txt` に Sitemap 行を足す:
      `Sitemap: https://<ドメイン>/sitemap-stories.xml`
- [ ] Search Console にドメインを登録し sitemap を出す（タグ SEO の起点）
- [x] `deploy/backup.sh` を手で 1 回実行し、復元訓練 OK のログを見る
      （2026-08-17 実施。アカウント 1 / Story 1 / 画像 0・復元訓練 OK）

**この手動実行は、timer を有効にする前に済ませること。**
先に timer を有効にすると、最初の 1 本が取れるまでの間、死活確認が
「バックアップの置き場がありません」で鳴る（**正しい鳴り方だが、
手順の順番で避けられる**）。

## 6. GAMEYARD と同居させる場合

ポートは衝突しない（GAMEYARD: 8787/3000/8788、CreatorYard: 8798/3000）
**…が web の 3000 だけ衝突する**。CreatorYard 側を 3001 にする。
**直す場所は 3 か所**で、**1 つでも忘れると静かに壊れる**:

1. `creatoryard-web.service` の `-p 3000` を `-p 3001` に
2. nginx の upstream も合わせる
3. **`/etc/creatoryard/creatoryard.env` に `HEALTH_WEB=http://127.0.0.1:3001`**
   —— これを忘れると、**死活確認は 3000（＝ GAMEYARD）を見て**
   「web の応答に一覧の見出しがありません」と**鳴り続ける**。
   2026-08-17 の本番で実際に起きた。**鳴りっぱなしの警報は、
   警報が無いのと同じか、それより悪い**（誰も見なくなる）
**同居機でのビルドは
`NODE_OPTIONS=--max-old-space-size=1024` を付ける**（Next のビルドは
1〜2GB 使うことがあり、空きが少ないと OOM killer が同居中の GAMEYARD を
先に殺しかねない。2026-08-14 の設置では上限付きで両ビルドとも完走した）。
メモリは GAMEYARD の clamd ピーク（~1.9GB）に
CreatorYard の 2 プロセス（~600MB）が乗るので、**4GB 機なら同居可、
余裕を見るなら別 VPS**（社長の判断）。

## 7. 切り戻し

- コードの問題: `git -C /opt/creatoryard checkout <前のタグ>` →
  `npm ci` → 両ビルド（`npm run build` と **`npm run build:server`**）→ `systemctl restart creatoryard-api creatoryard-web`
- データの問題: `systemctl stop creatoryard-api` →
  `/var/backups/creatoryard/` の tar.gz を `/var/lib/creatoryard/` に展開 →
  起動。**manifest の件数と展開後の件数を必ず照合する**

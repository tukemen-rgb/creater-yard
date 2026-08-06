# CreatorYard

**つくる人を、育てる。** — ゲームを作る人が、制作の記録を残し、知見を
分かち合い、仲間とつながる場所。

姉妹サービス [GAMEYARD](https://play-game-yard.com)（つくったゲームを、
届ける。）の「人」側。GAMEYARD が作品の置き場なら、CreatorYard は
作り手の置き場。

## 状態

**MVP 実装済み（未公開）。** 最初の機能は **Creator Story**（制作記録）だけに
絞る。相手がいないと成立しない機能（Guild / Help Wanted / Mentor）は、
人が集まってから解放する（空の部屋を最初の利用者に見せない）。

動くもの: アカウント（ハンドル＋パスワード、GAMEYARD の自前認証を流用）、
Story の投稿・編集・削除・下書き、画像添付（GAMEYARD の画像検査を流用。
多重形式・展開爆弾・SVG を入口で断る）、一覧（新着順）、個人ページ
（Timeline の原型）、つまずきタグ（ツール×トピックの 2 軸）と索引、
GAMEYARD 作品への手動リンク、パスワード再設定（メール。SMTP を設定する
まで API は「使えない」と明示する — 実装していないふりも、あるふりもしない）。

## 決まっていること

構想・分析・決定の記録は GAMEYARD リポジトリの
`docs/creatoryard/`（ANALYSIS / HYPOTHESIS / BRAND / IMPROVEMENTS /
ACQUISITION / CEO_REVIEW）にある。**ここに複製しない**（2 か所にあると
どちらが最新か分からなくなる）。

- 別ドメイン・別リポジトリの姉妹サービス（GAMEYARD の検索資産に触らない）
- MVP は Story のみ（D-CY3=A）
- 決済は持たない。収益化は本人の外部リンクで（D-CY4=C）
- 数字を競争にしない（ランキング・称号を作らない。GAMEYARD と同じ文化）
- 使った AI ツールを隠さず書ける場にする

## 技術方針（GAMEYARD と同じ型）

- Next.js（App Router）・実行時依存は next / react / react-dom の 3 つだけ
- 静的優先＋軽いサーバー。自前実装を基本にし、依存を増やさない
- 検査・認証・上限を緩めない。個人単位の行動計測はしない（合計値のみ）

## 開発

```sh
npm ci
npm run dev      # 開発サーバー（:3000）
npm run api      # Story API（:8798。依存ゼロの Node サーバー）
npm run lint     # ESLint + 型検査
npm run build    # 静的書き出し（out/）
npm run test:server  # サーバー側の通し試験（node:test）
```

開発中はサイト（:3000）と API（:8798）が別ポートになるので、API 側を
`CY_ALLOW_ORIGIN=http://localhost:3000 npm run api` と起動して CORS を
明示的に開ける。本番は同一オリジン（リバースプロキシで `/api` を API へ
寄せる）を想定していて、その場合 CORS は閉じたまま。データは
`server/store/`（1 件 1 JSON。コミットしない）。

### 2 モード構成（GAMEYARD と同じ型）

- `SITE_MODE=static`（既定の `npm run build`）… 固定ページ（トップ・
  ログイン・書く画面など）を `out/` に書き出す。CDN・静的ホスティング用
- `SITE_MODE=server`（`npm run build:server` → `npm run start:server`）…
  Story の本文（`/story/<id>/`）・一覧（`/stories/`）・書き手ページ
  （`/creators/<handle>/`）・タグ索引（`/tags/`）をリクエスト時に組み立てて
  HTML で返す。本文が HTML に入ることがタグ SEO の前提
- 前段（nginx など）は静的ファイルがあればそれを返し、無いパス
  （`/story/` `/creators/` `/stories/` `/tags/` `/api/`）を server モードへ回す
- `npm run dev` は server モードで立ち上がる（全ルートが動く）。
  下書きのプレビューだけは実 URL ではなく `/story/?id=` （本人トークン
  つきでブラウザから API を読む）

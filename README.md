# CreatorYard

**つくる人を、育てる。** — ゲームを作る人が、制作の記録を残し、知見を
分かち合い、仲間とつながる場所。

姉妹サービス [GAMEYARD](https://play-game-yard.com)（つくったゲームを、
届ける。）の「人」側。GAMEYARD が作品の置き場なら、CreatorYard は
作り手の置き場。

## 状態

**MVP 開発中（未公開）。** 最初の機能は **Creator Story**（制作記録）だけに
絞る。相手がいないと成立しない機能（Guild / Help Wanted / Mentor）は、
人が集まってから解放する（空の部屋を最初の利用者に見せない）。

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
npm run dev      # 開発サーバー
npm run lint     # ESLint + 型検査
npm run build    # 静的書き出し（out/）
```

# HANDOVER — CreatorYard 引き継ぎ（2026-08-06 起草）

新しいチャット（セッション）がこの文書だけで背景を把握できるように書く。
経緯の原本は GAMEYARD リポジトリ（`tukemen-rgb/site`）にあり、ここには
**要約と参照先**を置く。

## 1. 登場人物と役割

| 誰 | 役割 |
| --- | --- |
| **社長**（GitHub: tukemen-rgb、メール tukemen@ramenbu.com） | すべての決定。公開の 1 手。ハンドル `sidra_studio`（GAMEYARD の運営アカウント）。屋号は SIDRA STUDIO |
| **ChatGPT** | 戦略・設計レビュー。社長経由で Issue にコメントが貼られる |
| **Claude（あなた）** | 実装・検証・文書化・運用。判断材料は書くが、方針の決定はしない |

連携方法: **AI Review Board ＝ 各リポジトリの Issue #1**。
ChatGPT と Claude は直接つながっておらず、**社長が両者の間の運び役**。
Claude は作業のたびに Issue #1 へ報告し、ChatGPT のレビューもそこに貼られる。

## 2. これまでの経緯（時系列の要約）

1. **GAMEYARD**（ゲーム投稿PF＋Steam/itch 収集カタログ 21,907 件）を
   Claude が自動ループ（90 分ごと）で開発。実行時依存 3 つ・自前実装・
   ClamAV 8 段階検査・別オリジン配信という省力・安全構成
2. **2026-08-05〜06 に本番公開**: ConoHa VPS（Ubuntu 24.04）、
   本体 https://play-game-yard.com ＋ 配信 https://gameyard-games.com、
   Let's Encrypt、Gmail SMTP、管理者 `sidra_studio`。稼働中
3. **2026-08-06、ChatGPT が「CreatorYard」構想（26 タスク）を提示**。
   Claude が精査し（作れる／決定後／縮める／作らない）、勝ち筋の仮説と
   反証条件・ブランド草案・決定シートを作成
4. **社長が決定**（チャットで「OK それで行こう」）:
   改善策 7 案の方向で進める。集客は多チャネルで
5. 社長がこのリポジトリ（`creater-yard`）を作成し、Claude が土台
   （README・SPEC・準備中トップ）を push した（`7edc21a`）
6. **このリポジトリ以降、CreatorYard の作業はここで行う**
   （GAMEYARD のチャット・Issue は GAMEYARD 専用に戻す）

## 3. 決定済み事項（社長決定。覆すには社長の言葉が要る）

| # | 決定 |
| --- | --- |
| D-CY1 | **やる**（CreatorYard を建てる） |
| D-CY2 | **別ドメイン・別リポジトリの姉妹サービス**（GAMEYARD の URL・検索資産に触らない） |
| D-CY3 | **MVP は Creator Story のみ**（Guild/Help/Mentor は人が集まってから） |
| D-CY4 | **決済は持たない。本人の外部決済リンクのみ**（Booth/Stripe 等） |
| 集客 | 多チャネル方針。優先順位: GAMEYARD 内導線 → Discord → X → ジャム → タグ SEO |

## 4. まだ決まっていないこと（人待ち）

- ~~**ドメイン**~~ → **`creatoryard.io` を取得済み**（2026-08-09 22:19 JST）。
  Cloudflare Registrar・GAMEYARD の `play-game-yard.com` と同じアカウント
  （ネームサーバーが同じ組であることを RDAP で確認）。期限 2027-08-09。
  **DNS を向けても、段階 B で nginx に設定を足すまでは正しく出ない。**
  **サブドメインに寄せる案は退けた** — 2026-08-06 の「別ドメイン・
  別リポジトリの姉妹サービス」を維持する。理由はセキュリティで、
  別ドメインだとログイン状態（`localStorage` のトークン）が
  GAMEYARD と完全に隔離される
- **Discord 開設**（全集客チャネルの着地点）
- リポジトリ名の綴り（現 `creater-yard`。ブランドは CreatorYard）
- 公開時期（MVP が動いてから）

## 5. いまの状態と次の実装

- 済み: Next.js 土台（静的ビルド緑）・SPEC・準備中トップページ
- **次: Story の実装**。順序 — ①アカウント（GAMEYARD の自前認証方式を
  流用）→ ② Story 投稿・下書き → ③ 一覧・個人ページ（Timeline の原型）
  → ④ つまずきタグ。詳細は `SPEC.md`
- **撤退条件が先に決めてある**: 公開 30 日で書き手 10 人・Story 30 本に
  届かなければ機能追加を止めて社長に再判断を仰ぐ（`SPEC.md` §4）

## 6. 参照先（原本のありか）

すべて `tukemen-rgb/site` リポジトリ（必要なら add_repo で読む）:

| 文書 | 中身 |
| --- | --- |
| `docs/creatoryard/ANALYSIS.md` | ChatGPT の 26 タスクの精査（作らない理由を含む） |
| `docs/creatoryard/HYPOTHESIS.md` | なぜ勝てるか（5 問への回答＋反証条件） |
| `docs/creatoryard/IMPROVEMENTS.md` | 改善策 7 案（＝採用された方向） |
| `docs/creatoryard/ACQUISITION.md` | 集客 18 チャネルと優先順位 |
| `docs/creatoryard/BRAND.md` | Mission/Values 候補・コピー 20 案・配色（アンバー） |
| `docs/creatoryard/CEO_REVIEW.md` | 決定シートと決定の記録 |
| `docs/creatoryard/SNS_TEMPLATES.md` | X 投稿テンプレ 20 本 |
| `SPEC.md`・`docs/culture.md`・`docs/vision.md` | GAMEYARD の方針・文化（引き継ぎ元） |

## 7. 働き方の決まり（GAMEYARD で確立した型）

- 作業のたびに **Issue #1（このリポジトリ）へ報告**を書く（帰属フッター付き）
- コミットは小さく分ける。push 先は main（保護なし・単独開発）
- 推測で埋めない。件数目標のために創作しない（実在の個人・数字）
- 要判断（決済・行動計測・ランキング・第三者 JS）は提案止まりにして
  社長の決定を待つ
- lint（ESLint＋tsc）と build を毎回通す。画面はブラウザで実物を見る

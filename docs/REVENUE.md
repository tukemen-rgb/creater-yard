# 収益戦略（2026-08-16 社長決定）

社長決定の記録と、CreatorYard 側の設計への落とし込み。
**決定の原文は Issue #1 のコメント**（このファイルは整理版）。

## 決定の骨子

SIDRA STUDIO は「作品」と「クリエイター」の **2 つの経済圏**を作る。

| | GAMEYARD | CreatorYard |
| --- | --- | --- |
| 役割 | 作品が育つ場所 | クリエイターが育つ場所 |
| 主役 | ゲーム | クリエイター |
| ブランド | 作品の経済圏 | Creator Economy |
| 収益 | 広告・アフィリエイト・特集掲載・ネイティブ広告 | Creator Partner・企業スポンサー・スキル販売・Recipe 販売・Mentor・テンプレート販売 |
| 収益の型 | 作品を見る → 広告 | Creator が集まる → Creator Partner |
| 将来 | — | Creator 向けプレミアム機能を検討 |

- GAMEYARD の広告は**第三者 JS を使わず**、設計思想（安全性）を壊さない
  方法が前提（社長明記）
- 企業は「スポンサー」ではなく **Creator Partner** — 広告を出すためでは
  なく、Creator 文化を一緒に作るために参加する。この思想が最優先
- 営業資料は GAMEYARD（広告営業）と CreatorYard（Creator Partner 営業）で
  **完全に分ける**
- CreatorYard では企業が参加しやすいイベント（Creator Challenge /
  Workshop / Learning Week 等）も設計する

## CreatorYard 側の設計方針（決定から導かれること）

1. **収益はクリエイターの側に立つ形だけ**。閲覧者への広告掲示はしない
   （それは GAMEYARD の経済圏。混ぜると 2 つの経済圏を分けた意味が消える）
2. **文化の制約は収益より先にある**（守ることは CLAUDE.md）:
   - 数字を競争にしない → Partner 向けの成果報告も**サイト全体の合計値のみ**。
     「どの Creator が何回見られたか」は存在しないデータなので提供できない
     — これは制約であると同時に、行動ターゲティング広告と一線を引く
     Creator Partner の売りでもある
   - 個人単位の行動計測をしない → 計測タグ・トラッキングピクセルは
     Partner にも渡さない
   - 第三者 JS を入れない → Partner の表示もすべて自前実装
3. 制度・イベントの設計案は `docs/proposals/creator-partner.md` と
   `docs/proposals/creator-events.md`。営業資料の草稿は
   `docs/sales/creator-partner-pitch.md`

## 既存決定との整合（社長回答済み・確定）

| # | 確認事項 | 決定 |
| --- | --- | --- |
| Q1 | 販売系（スキル・Recipe・テンプレート）の決済 | **外部リンク（D-CY4 のまま）**。CreatorYard は陳列と導線だけを持ち、決済は本人の外部決済リンク（Booth/Stripe 等） |
| Q2 | Creator Partner の対価の受け方 | **サイトに決済は持たない**。請求書（銀行振込）ベース |
| Q3 | スキル販売・Mentor の実装順序 | **前倒し**。D-CY3 の「人が集まってから」を収益の柱（出品＝陳列機能）については解除。Guild / Help Wanted は据え置き |

これにより実装するのは**出品（陳列）機能**: Creator がスキル・Recipe・
テンプレート・Mentor 受付を並べ、購入・依頼は外部リンクへ。
サイトはどこまでも「場」であり、金銭のやり取りには入らない。

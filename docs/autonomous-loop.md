# 自動で作り続けるときの決まり（CreatorYard 版）

無人で回す前提の作業規則。原本（動いている版）は GAMEYARD の
`tukemen-rgb/site` の `docs/autonomous-loop.md`。ここには CreatorYard の
実情に合わせた版を置く。**判断に迷ったら止まって聞く**のではなく、
**判断に迷うことをそもそも作業に含めない**（迷う類のものは人＝社長が決める）。

## 分担（毎時・10 分間隔・1 時間で 1 サイクル）

時刻は JST。分だけの指定なので UTC でも同値。

| 分 | 担当 | 役割 |
| --- | --- | --- |
| :00 | **gdp（ChatGPT）** | 戦略・設計レビュー。Issue #1 にコメント |
| :10 | Claude ① | 調査・提案 |
| :20 | Claude ② | 技術設計 |
| :30 | Claude ③ | 実装 |
| :40 | Claude ④ | 監査・報告 |
| :50 | Claude ⑤ | 調停 |

往復は **AI Review Board =
[Issue #1](https://github.com/tukemen-rgb/creater-yard/issues/1)** で行う。
gdp は呼ばれたときだけ動く（社長が起動する）。動いたほうが Issue に書く。

## 5 役の中身

| 分 | 役割 | 出力先 |
| --- | --- | --- |
| :10 | ① 調査・提案（gdp の意見＋他社事例。**gdp の意見が無い／承認待ちで止まっているときは、これまでの GitHub の内容から Claude が自分で論点を立てて提案する**） | docs/research/case-studies.md, proposals.md |
| :20 | ② 技術設計（セキュリティ節を必須にする） | docs/research/designs.md |
| :30 | ③ 実装（設計を実装・試験・commit） | コード＋designs.md に実装済み印 |
| :40 | ④ 監査・報告（①〜③の一貫性とセキュリティ→docs/cycle-report.md→Issue #1） | docs/cycle-report.md, Issue #1 |
| :50 | ⑤ 調停（gdp と Claude の意見のズレを、**書き手の体験・人が集まり残るか（集客/定着）・セキュリティ**の中立で裁いて①〜④へ次の指示を出す） | docs/research/mediation.md, Issue #1 |

- 事例は出典つきで確かめられたものだけ書く。数を埋めるための推測・創作を書かない
- designs に未実装が無いとき、②は proposals の未設計と決定済み TODO の
  未着手の**先に決まったほう**を取る（GAMEYARD の恒常規則を引き継ぐ）
- 前の周がまだ走っていたら重ねずに見送る

## 共通ルール（毎回・全役割）

1. **Issue #1 はコメント総数で見る。** まず issue_read（method: get）で
   `comments` の総数だけを確認し、**前回確認時から増えたときだけ**
   get_comments の最後のページを読む。増えていなければ読まない。
   総数の記憶が失われたときだけ、最後のページを読み直す
2. **前の役割の処理（background 含む）がまだ走っていたら、この回は見送る。**
   走っている処理を**切り上げない**
3. **10 分に収まらない処理は background で回す**（重いビルド等）。
   終わるまで次の役割は見送りにする
4. **変化が無い周は確認だけでスキップする。** commit も Issue への投稿もしない。
   10 分間隔はトークン消費が大きい（90 分 1 本と比べ約 10 倍超）。
   この規則が効いて初めて成り立つ
5. コードを触ったら `npm run lint`（ESLint＋型検査）と `npm run build`
   （静的書き出し）を通す。画面を触ったらブラウザで実物を見る
6. push 先は作業ブランチ。既定ブランチへ直接 push しない
7. Issue #1 への投稿には帰属フッターを付ける
8. commit は小さく分ける。大きな変更は理由をコードのそばに残す

## 人が決めるまで変えない一覧（CreatorYard 固有・育てる）

社長の言葉が無い限り、提案止まりにする。作業中に増えたらここへ追記する。

- **決済を持たない**（収益化は本人の外部リンクのみ。D-CY4=C）
- **依存パッケージを増やさない**（実行時は next / react / react-dom の 3 つだけ）
- **数字を競争にしない**（ランキング・称号・公開カウンタを作らない）
- **個人単位の行動計測をしない**（持つのは合計値だけ）
- 検査・認証・上限を緩めない。第三者 JS を入れない
- 公開（本番反映）・ドメイン取得・Discord 開設・リポジトリ名の変更
- MVP の範囲変更（Creator Story のみ、を広げる／狭める）
- 撤退条件（`SPEC.md` §4）の変更

## 環境メモ（このリポジトリで実際に踏んだものだけ書く）

**他プロジェクトのメモを持ち込まない。** GAMEYARD の clamd・pgrep・
Playwright のメモは GAMEYARD 固有で、ここには当てはまらない。
このリポジトリで実際に踏んで確かめたことだけを追記する。

- コンテナが新しいと `node_modules` が無く、lint がグローバルの ESLint 10 で
  落ちる（`@eslint/eslintrc` が見つからない）。**先に `npm ci` を実行する**
  （2026-08-08 に③で実際に踏んだ）
- ブラウザ確認は Playwright のグローバル版を使う（リポジトリに依存を足さない）。
  `/opt/node22/lib/node_modules/playwright` を作業ディレクトリ外の
  node_modules に symlink し、`chromium.launch({ executablePath:
  '/opt/pw-browsers/chromium' })` で起動する（2026-08-08 に③で実際に踏んだ。
  `@playwright/test` は入っていない。import は `'playwright'` から）

## 記録

- `docs/research/` — ①②⑤の受け皿（上の表のとおり）
- `docs/cycle-report.md` — ④のレポート（Issue #1 と同内容を履歴として残す）
- 仕様が実際に変わったら `SPEC.md` へ反映する

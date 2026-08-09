# 技術設計（役割②の出力）

役割②が proposals.md の最新（または調停の指示）を設計に落とす。新しいものを上に。
役割③はここの最新の「未実装」を実装し、済んだら「実装済み <hash>」と印を付ける。

必須の節: 変更対象ファイル / データモデル / 経路・画面 / 試験計画 /
**セキュリティ（脅威と対策。検査・認証・上限は緩めない。第三者 JS なし・
個人単位の行動計測なし・決済なしを壊さない）**

---

## 2026-08-09 11:21 JST 書き手になる入口と、登録後・ログイン後の道筋 — 状態: 実装済み c31197f（lint・build・試験 35 件緑。ブラウザ実物確認 6 点 OK）

出典: 調停 10:51（静穏運転の例外として認可。範囲は 3 か所・リンクを足すだけ）。
材料: proposals 10:14（11:12 訂正済み）、事例 25（空の状態）・26（`<nav>`）。
**この設計はドメイン・公開時期・main 反映のどれにも依存しない。**

### 実装前に確かめた事実（ここが設計の前提）

コードを読んで確かめた。**提案より状況は良い部分と、悪い部分の両方がある。**

- `/write/` は**未ログインのとき既に `/login/` と `/register/` へのリンクを
  出している**（`app/write/page.tsx`「ログインが必要です」）。
  つまり `/register/` へ至る道は**存在するが、その入口である `/write/` に
  どこからも辿り着けない**。鎖は最初の 1 本目で切れている
- したがって**「書く」を nav に足すだけで、登録までの鎖がつながる**。
  修繕の中心はここ
- `.site-nav` は `display:flex; gap:4px` で、`a` の見た目も定義済み
  （`app/globals.css` 77–92 行）。**CSS は 1 行も足さない**
- `app/layout.tsx` は**サーバーコンポーネントのまま**にする。ログイン状態で
  nav を出し分けようとすると `'use client'` が必要になり、全ページが
  クライアント描画に倒れる。**出し分けはしない**

### 設計の決め

1. **nav（`app/layout.tsx`）に内部リンクを 2 本足す**:
   「制作記録」→ `/stories/`、「書く」→ `/write/`。既存の GAMEYARD リンクは
   **外部なので最後に置く**。`<nav aria-label="メインナビゲーション">` は
   既にあるので**中身を足すだけ**（事例 26）
   - **誰にでも同じものを見せる**。未ログインで「書く」を押した人は
     既存の「ログインが必要です」画面に着き、そこから登録できる。
     これは案内として正しく、隠す情報も無い
2. **トップ（`app/page.tsx`）に登録への直接の入口を 1 本足す**:
   既存の「新着の制作記録を見る」の並びに「**書き手になる**」→ `/register/`。
   読みに来た人が最初に着く面に、**書く側へ回る道**を置く
   - nav を 4 本にはしない。ページが 3 枚のサイトで見出しを増やすより、
     読者が着く面に置くほうが効く
3. **登録の成功画面（`app/register/page.tsx`）**: 「登録できました」の下に
   **`/write/`（最初の 1 本を書く）**と **`/w/<handle>/`（自分のページ）**の
   2 本。`<handle>` は API が返した値をそのまま使う
4. **ログイン中の画面（`app/login/page.tsx`）**: 同じ 2 本を足す。
   ログアウトのボタンは**そのまま残す**

**数字・称号・順位は一切出さない**（決定「数字を競争にしない」）。

### 範囲外（今回やらない）

- 投稿成功画面（`/write/` の「公開しました」）は **`もう 1 本書く` ボタンだけ**で、
  公開した Story 自身にも一覧にも戻れない。**同じ family の欠けだが、
  ⑤の認可は 3 か所に限られている**ので今回は触らない。
  **①への申し送り: 別の提案として出すこと**

### 変更対象ファイル

`app/layout.tsx`（nav に 2 本）・`app/page.tsx`（登録への入口 1 本）・
`app/register/page.tsx`（成功画面に 2 本）・`app/login/page.tsx`
（ログイン中に 2 本）。**CSS・新規ファイル・依存の追加なし。**

### データモデル

**変更なし。**保存する値も API の形も一切触らない。

### 経路・画面

新しい URL は作らない。既存の `/`・`/stories/`・`/write/`・`/register/`・
`/login/`・`/w/<handle>/` を結ぶだけ。`/w/<handle>/` はシェル方式のままで、
本番は nginx の rewrite、開発時は `?handle=` の fallback（現行どおり）。

### 試験計画

- `npm ci` → `npm run lint` → `npm run build`（静的）→ 既存試験 35 件が緑
- **ブラウザ実物確認**（Playwright のグローバル版・環境メモのとおり）:
  1. トップに「書き手になる」があり `/register/` に着く
  2. ヘッダーの「書く」から `/write/` に着き、**未ログインなら
     「ログインが必要です」＋登録リンク**が出る
  3. 登録直後の画面に `/write/` と `/w/<handle>/` のリンクが出る
  4. ログイン中の画面に同じ 2 本とログアウトが出る
- **鎖の確認**: 未ログインの状態でトップから始め、**URL を一度も打たずに**
  登録 → 投稿画面まで到達できること

### セキュリティ（脅威と対策）

- **リンクを足すだけ。認証・上限・検査には触れない**（トークンの扱い・
  ログイン試行の待ち・入力上限はすべて現行のまま）
- nav をログイン状態で出し分けない ＝ **layout をサーバーコンポーネントの
  ままに保つ**。クライアント化して認証状態を全ページで読むと、
  トークンの取り扱い面が広がる。広げない
- `/w/<handle>/` のリンクは API が返した `handle` を使う。`handle` は
  登録時に `^[a-z0-9][a-z0-9_-]{2,31}$` で検査済みで、URL 経路に入れて安全。
  HTML を組み立てず JSX に渡す（エスケープは React 任せ）
- 未ログインの人に「書く」を見せることは情報の漏れではない。
  **押した先で認可されるかどうかは API が決める**（現行の me/トークン検証）
- 依存追加なし・第三者 JS なし・計測なし・決済なし・ランキングなし

## 2026-08-09 03:22 JST 公開運用（静的焼き込み・見つかる面 4 点・環境変数）— 状態: 未実装（**実装の着手は社長判断待ち**）

出典: 調停 02:50（MVP 完了→公開準備フェーズ。設計だけ進め、実行は人が決める）。
材料: proposals 22:12（Story 固有 OGP）・01:12（sitemap）・02:12（robots）、
事例 17・18・20・21。**ドメイン名は書かない**（決定待ち。すべて環境変数）。

### この設計が要る理由

MVP は「静的シェル＋API fetch」で配っている（21:22 の決定・SPEC §3 注記済み）。
この方式では **SNS クローラと検索エンジンに中身が見えない**（どちらも JS を
実行しない前提で設計する）。集客チャネル決定の「タグ SEO」と「X」を効かせるには、
公開済み Story を**ビルド時に焼き込む**経路が要る。焼き込みは鮮度が
再ビルド体制に依存するので、両者はセットでしか設計できない。

### 段階割り（社長の決定が出てから着手）

### 一次資料で確定した前提（2026-08-09 05:22 補記・事例 22）

Next.js 公式（Static Exports）に照らして 3 点を確定した。**選択ではなく制約**。

1. **ISR は `output:'export'` では使えない**。「投稿のたびに部分再生成」は
   選べないので、段階 B の「定期ビルド＋手動トリガ」は前提として書く
2. **`dynamicParams: true` が使えない** → 焼き込み後に投稿された Story は
   静的側に存在しない。**nginx の try_files を「静的ファイル →
   シェル」の順にする**（下記）。これを忘れると新着 Story が 404 になる
3. sitemap / robots は **`export const dynamic = 'force-static'` を付けた
   GET の Route Handler** として焼ける（`app/sitemap.ts`・`app/robots.ts`）。
   rewrites / redirects / headers は Next 側で書けないので nginx が担当（現行どおり）

```nginx
# 焼き込み導入時の置き換え（現行は try_files /s/index.html =404）
location ~ ^/s/[a-f0-9]{16}/?$ {
    # 焼いた静的ページがあればそれ、無ければシェルに落として fetch で表示
    try_files $uri $uri/index.html /s/index.html;
}
```

- **段階 A: 焼き込みの生成物**（ドメイン非依存・決定前でも実装可能）
  - `SITE_MODE=static` のビルドで、公開 Story を `generateStaticParams` で
    `/s/<id>/`・`/w/<handle>/`・`/tags/<tag>/` として焼く。データ源は
    **API ではなく `data/stories/` を直接読む**（ビルド時にサーバーが
    上がっていなくても焼ける。GAMEYARD と同型）
  - 各ページで Story 固有の OGP（og:title / og:description=本文冒頭 /
    og:url / og:type=article）を head に出す（proposals 22:12 の持ち越し分）
  - `sitemap.xml`（ルート直下）と `robots.txt`（全許可＋`Sitemap:` 行のみ）を生成
  - **`lastmod` の作り方を実装前に固定する**
    （2026-08-09 09:20 補記・proposals 09:14・事例 24）

    | 対象 | `lastmod` に入れる値 |
    | --- | --- |
    | Story `/s/<id>/` | その Story の **`updatedAt`** |
    | 個人 `/w/<handle>/` | そこに載る**公開 Story の `updatedAt` の最大値** |
    | タグ `/tags/<tag>/` | 同上（そのタグの公開 Story の最大値） |
    | 固定ページ | **`lastmod` を出さない**（`<loc>` だけ載せる） |

    - **固定ページに `lastmod` を持たせない理由**（2026-08-09 10:20 補記・
      ④ 09:41 の差し戻し）: 当初は「内容を変えたときだけ手で更新する日付」と
      書いていたが、**人が維持する日付は更新を忘れた瞬間に不正確になる**。
      そしてこの設計自体が「Google は `lastmod` が**一貫して**正確なときだけ
      使う」（事例 24）を根拠にしている以上、忘れられた固定ページの日付 1 つで
      **サイト全体の `lastmod` が信用されなくなる**。ここで潰したはずの穴に
      別の入口から入ることになる。`<lastmod>` はそもそも任意で、必須は
      `<urlset>`・`<url>`・`<loc>` だけ（事例 20）。**持たないほうが正確**
    - 公開 Story が 0 件の個人ページ・タグページは **sitemap に出さない**
      （`lastmod` の元になる値が無いページを載せない）。
      **ただしそのための処理は書かない**（2026-08-09 10:20 補記・④ 09:41）:
      段階 A のデータ源は `data/stories/` の**公開 Story だけ**で、個人ページも
      タグページもそこから導出されるので、公開 Story が 0 件のページは
      **そもそも生成されない**。除外処理を別に足すと死んだコードになる。
      ③は「意図が満たされていること」を確認するだけでよい
    - **禁止: ビルド時刻・`out/` のファイル mtime・`new Date()` を
      `lastmod` に使わない。** 理由をその場にコメントで残す
    - 理由: 焼き込みは公開ページを**毎回全部書き出す**ので、ファイルの
      更新時刻から作ると全ページが毎回「更新された」ことになる。Google は
      `lastmod` を「**一貫して、検証可能な形で正確なとき**」にだけ使うと
      明記しており（実際のページ更新と突き合わせる）、毎回全更新の
      sitemap はその条件を外れて **`lastmod` ごと無視される**。
      制作記録は「つまずきが解決したら書き足す」形式で後から更新されるため、
      更新が正しく伝わらないと sitemap を出す意味が消える
    - **sitemap の分割は作らない**。上限は 50MB / 50,000 URL で、
      撤退条件（30 日で書き手 10 人）の規模とは桁が違う。必要になってから作る
    - Search Console への登録は**要判断（社長）**。robots.txt の `Sitemap:` 行
      だけで送信は足りるので、この設計には含めない
  - **焼いた静的ページと、既存のシェル＋fetch は共存させる**。静的側が
    無い id（焼き込み後に増えた分）は nginx の try_files でシェルに落ちる
- **段階 B: 再ビルド体制**（VPS 側の運用。**社長の実行判断が要る**）
  - 投稿・更新のたびに全焼きし直すのは重い。**日 1 回の定期ビルド＋
    手動トリガ**で始める（GAMEYARD の release パイプラインと同じ考え方）。
    間の鮮度はシェル＋fetch が担保する
  - 手順書を `docs/release.md` に置く（ビルド→検証→切替→巻き戻し）
  - **初回公開の手順は「やり直せる回数が有限」を前提に組む**
    （2026-08-09 06:22 補記・proposals 06:12・事例 23）:
    1. DNS を向ける → **証明書はまずステージング**（certbot なら
       `--dry-run`、または `--server` でステージング ACME）で 1 回通す
    2. nginx の設定（try_files の順序・API proxy・feed の対応）を
       **HTTP のまま**確かめる
    3. そのうえで本番証明書を取る。**失敗したら原因を直してから再試行**し、
       闇雲に叩かない
    - 理由: 同じドメイン構成の本番証明書は **7 日で 5 枚**、認証失敗は
      **1 時間・識別子あたり 5 回**が上限。公開当日に試行錯誤すると
      使い切って 7 日待ちになり、公開日が飛ぶ。撤退条件（公開から 30 日）の
      起点もずれる。GAMEYARD は通ったが CreatorYard は別ドメイン・別構成
- **段階 C: SMTP**（パスワード再設定。**契約は社長判断**）
  - 未設定なら「再設定は使えません」と正直に答える現状のまま。
    設定されたら有効になる形にする（GAMEYARD の mailer と同型）

### 変更対象ファイル（段階 A）

`app/s/page.tsx`・`app/w/page.tsx`・`app/tags/page.tsx`（静的パラメータと
metadata の生成を追加。client 部分はそのまま）、`lib/stories-static.ts`（新規・
ビルド時に data/stories を読む）、`app/sitemap.ts`・`app/robots.ts`（Next の
規約ファイル）、`docs/nginx.example.conf`（try_files の順序）、`SPEC.md`

### データモデル

変更なし（既存の `data/stories/*.json` をビルド時に読むだけ）

### 経路・画面

URL は現行のまま（`/s/<id>/`・`/w/<handle>/`・`/tags/<tag>/`）。
**購読 URL・タグ URL は変えない**（永続契約。proposals 21:12）

### 環境変数の一覧（運用が設定する。コードに実値を焼かない）

| 変数 | 使う場所 | 意味 | 未設定時 |
| --- | --- | --- | --- |
| `SITE_ORIGIN` | server/lib/feed.mjs | 公開オリジン（feed の link・sitemap の loc） | localhost:3000（確認用） |
| `NEXT_PUBLIC_WRITE_API` | lib/write-api.ts | 書く側 API の基底 URL | 「準備中」と表示 |
| `WRITE_API_ORIGIN` | server/api.mjs | CORS で許す本体オリジン | `*` |
| `AUTH_SECRET` | server/lib/auth.mjs | トークン署名鍵（32 文字以上） | 0600 のファイルを自動生成 |
| `SITE_MODE` | next.config.mjs | static / server | static |
| `PORT` | server/api.mjs | API の待ち受け | 3010 |

**公開時は `SITE_ORIGIN` と `WRITE_API_ORIGIN` を実ドメインで固定する**
（CORS の `*` のままにしない）。`AUTH_SECRET` は環境変数で明示的に与える。

### 試験計画

- 段階 A: 焼いた HTML に Story 固有の og:title が入る / sitemap に
  公開 Story だけが載る（**下書きが載らない**）/ robots.txt が全許可＋
  Sitemap 行 / 焼き込み後に増えた Story もシェル経由で開ける
- 段階 A の `lastmod`（09:20 補記）: **1 件も直さずに 2 回焼き、
  sitemap.xml が 1 回目と 2 回目で同一になること**を確かめる
  （ビルド時刻が混入していれば必ず差分が出るので、この 1 手で検出できる）。
  次に Story を 1 件だけ更新して焼き直し、**その Story と、それが載る
  個人ページ・タグページの 3 つだけ**が変わることを確かめる。
  あわせて**固定ページの `<url>` に `<lastmod>` が無いこと**を確かめる
  （10:20 補記）
- lint・build（静的）・既存試験 35 件が緑

### セキュリティ（脅威と対策）

- **下書きを焼かない**。ビルド時のデータ源でも `visibility === 'public'`
  だけを通す（store の境界を静的側でも同じ関数で使う）
- robots.txt で隠す運用をしない（隠す必要のあるページを公開側に作らない。
  事例 21）。sitemap にも公開分だけを載せる
- 焼き込みで生成する OGP の description は本文冒頭のプレーンテキスト。
  HTML を組み立てず Next の metadata API に渡す（エスケープを自前で書かない）
- CORS を本番で実オリジンに固定（`*` のままにしない）
- 検査・認証・上限の緩和なし。依存追加なし。計測なし・決済なし

### 人が決めるまで着手しないもの（この設計は提案止まり）

**公開（本番反映）・ドメイン取得・SMTP 契約・再ビルドの実行**。
段階 A（ドメイン非依存の生成物）だけは決定前でも実装できるが、
③は調停の指示が出てから取る。

## 2026-08-09 00:22 JST つまずきタグ UI（SPEC 実装順④・MVP 最後の決定済み）— 状態: 実装済み（A: b9cc6cd / B: 59962d5 / C: edca0de。**SPEC 実装順①〜④＝MVP の決定済み実装がすべて完了**）

出典: 調停 23:50。材料: proposals 17:12（自由入力＋正規化・各軸 5 個・
事前リストなし）・00:12（datalist 候補・件数を出さない・/api/tags.json）・
事例 8・9・19。

### 設計の決め

- **タグページの URL は軸で分けない**: `/tags/<tag>/`。1 つの語で
  ツール軸・つまずき軸の両方を横断して引く（URL 資産が一本化され、
  21:12 で予約した将来のタグ別 feed `/tags/<tag>/feed.xml` とも揃う）
- **正規化は保存時に store で行う**: 前後空白除去・連続空白の圧縮・
  ASCII 英字のみ小文字化（日本語はそのまま）・軸内の重複除去。
  表示は保存された形をそのまま出す
- **件数・人気順はどこにも出さない**（候補も名前だけ）

### 段階割り

- **段階 A: store の正規化＋タグ一覧 API＋試験**
  - stories.mjs: normalizeTag を入れ、create/update 時に適用
  - api.mjs: GET `/api/tags.json`（公開 Story の既出タグ。
    `{ tool: [...], topic: [...] }` の名前のみ・五十音/辞書順）
  - GET `/api/stories.json?tag=<tag>`（両軸横断の絞り込み。50 字以内・
    制御文字と `/` を含むものは 400）
- **段階 B: /write のタグ入力＋表示**
  - /write に 2 欄（ツール・つまずきトピック。読点/コンマ区切りの素の
    input＋datalist 候補 = /api/tags.json から）
  - Story ページ・一覧・個人ページにタグを表示（`/tags/<tag>/` へのリンク）
- **段階 C: タグページ `/tags/` シェル**（pathname 解析・?tag= fallback、
  nginx 例に rewrite 追加）＋ブラウザ実物確認

### 変更対象ファイル

A: `server/lib/stories.mjs`・`server/api.mjs`・`server/stories.test.mjs`・
`server/api.test.mjs`
B: `app/write/page.tsx`・`lib/write-api.ts`・`app/s/page.tsx`・
`app/stories/page.tsx`・`app/w/page.tsx`
C: `app/tags/page.tsx`（新規）・`docs/nginx.example.conf`

### データモデル

変更なし（tags.tool / tags.topic は最初から保存形式にある。正規化だけ追加）

### 経路・画面

上記のとおり。タグページの並びも新着順のみ

### 試験計画

- A: 正規化（空白・大文字・重複）/ tags.json が公開分の語彙だけ返す
  （下書きのみのタグが出ない）/ ?tag= の横断絞り込み / 不正な tag 400
- B・C: ブラウザ実物（datalist 候補・タグリンク・タグページ表示）
- 毎段階 lint・build・既存試験 32 件が緑

### セキュリティ（脅威と対策）

- タグはプレーンテキスト扱い・表示は React エスケープ（feed に載せる場合も
  XML エスケープ済みの既存経路のみ）
- ?tag= と /tags/ の入力は長さ 50 以内・制御文字/スラッシュ拒否
  （パス走査と URL 汚染を防ぐ）
- 下書きのみに存在するタグは tags.json に出さない（下書きの内容を
  語彙経由で漏らさない）
- 件数の集計・公開はしない（数字の競争面を作らない）。個人計測なし・
  依存追加なし

## 2026-08-08 21:22 JST 一覧・個人ページ（SPEC 実装順③）— 状態: 実装済み（A: 3a9cecf / B: 8d3a924 / C: 825c814。**SPEC 実装順③完了**）

出典: 調停 20:50（次は実装順③。主論点=静的/server の置き方）。
材料: proposals 19:12（RSS）・21:12（新着順のみ・URL の形）・事例 15・16。

### 主論点への答え: MVP は「静的シェル＋API fetch」で配る

- Story は実行時に増える。`output:'export'` の焼き込みは**ビルド時に
  存在した分しか含められず**、鮮度は再ビルド体制（公開運用の VPS 側の
  仕事）に依存する。MVP の間は **静的シェル＋client fetch** の 1 本で始める
  （GAMEYARD も投稿一覧・RSS は動的 API から配っている実物を確認済み）
- SEO 用の静的焼き込み（generateStaticParams で公開 Story を焼く）は
  **公開運用の再ビルド体制とセットで別設計**にする（タグ SEO=A1 に効くのは
  その段。いま作ると再ビルドが無くて腐る）
- この選択は SPEC §3「公開済み Story は静的に書き出して配信」と MVP の間
  だけずれるため、**SPEC §3 に「MVP の間はシェル＋API で配り、静的書き出しは
  公開運用の再ビルド体制とセットで導入する」の 1 行を追記**する（段階 A）。
  検査・認証・上限・決済・計測とは無関係の構成注記であり要判断にはしない
  （気になる場合は Issue #1 でどうぞ、と④のレポートに添える）

### 段階割り

- **段階 A: 一覧 `/stories/`**（静的シェル＋fetch・新着順のみ・ページ送り・
  空のときの文言）＋トップからの導線リンク＋SPEC §3 の注記追記
- **段階 B: Story ページと個人ページ**。URL は `/s/<id>`・`/w/<handle>`。
  静的シェル `/s/`・`/w/` を置き、client 側で pathname から id/handle を
  取って fetch（開発は next dev がそのまま解決。本番 nginx は
  `/s/…`→`/s/index.html` の rewrite。例を docs/nginx.example.conf に置く）。
  本文・つまずき・ツールの表示はエスケープされたプレーンテキスト。
  OGP は **layout にサイト共通の 4 つ（og:title/type/url/image）を置くだけ**。
  Story 固有の OGP はシェル方式では構造的に出せないため（SNS クローラは
  JS を実行しない）、静的焼き込み設計（公開運用）の必須要件に回す
  （proposals 22:12・事例 17 を反映）
- **段階 C: RSS**。API 側に `/api/feeds/stories.xml`（全体）と
  `/api/feeds/w/<handle>.xml`（書き手ごと）。**公開 URL は proposals 21:12 の
  形（`/stories/feed.xml`・`/w/<handle>/feed.xml`）を nginx の proxy で対応**
  させ、対応表を docs に残す（購読 URL は永続契約）。ブラウザ実物確認。
  実装要件（proposals 23:12・事例 18 を反映）: channel は
  title/link/description の 3 つ必須・item は title＋link＋pubDate
  （RFC 822 形式）・XML エスケープは GAMEYARD の feed 実装を流用・
  autodiscovery の `<link rel="alternate" type="application/rss+xml">` を
  layout（全体フィード）に置く。個人ページ用の差し替えは
  シェル方式では head を動的にできないため、全体フィード 1 本のみで始める

### 変更対象ファイル

A: `app/stories/page.tsx`（新規）・`app/page.tsx`（導線 1 行）・`SPEC.md`
B: `app/s/page.tsx`・`app/w/page.tsx`（新規）・`docs/nginx.example.conf`（新規）
C: `server/api.mjs`（feed 2 経路）・`server/api.test.mjs`

### データモデル

変更なし（listPublic / getVisible / listMine をそのまま使う。個人ページは
公開分のみ＝`/api/stories.json` に author 絞りを足す最小変更
`?author=<handle>` を段階 B で追加）

### 経路・画面

上記のとおり。並びは**新着順のみ**（人気順・急上昇を作らない。決定の適用）。
閲覧数の取得・表示もしない

### 試験計画

- A: 一覧の表示・ページ送り・空状態（ブラウザ）。lint/build 緑
- B: `?author=` の絞り（api.test）・存在しない id/handle の 404 表示・
  下書きが一覧にも個人ページにも出ない（既存試験＋ブラウザ）
- C: feed の XML が valid・公開分のみ含む・下書き混入なし（api.test）

### セキュリティ（脅威と対策）

- 表示は全てエスケープ済みプレーンテキスト（React の既定エスケープ。
  dangerouslySetInnerHTML を使わない）
- 一覧・feed は公開分のみを返す既存の境界（listPublic）だけを通す。
  下書きの秘匿は store 層の保証をそのまま使い、画面側で新しい境界を作らない
- `?author=` はハンドル形式（HANDLE_RE 相当）だけ受ける
- feed に含めるのはタイトル・本文冒頭・日時・リンクのみ。閲覧の計測なし
- 依存追加なし（RSS は GAMEYARD 同様に自前で組む）

## 2026-08-08 18:22 JST Story 投稿・下書き（SPEC 実装順②）— 状態: 実装済み（A: 3fb70d3 / B: 17cdd08 / C: 41e48eb・ブラウザ実物確認済み。**SPEC 実装順②完了**）

出典: 調停 17:50（決定済みの未着手を取る）。材料: SPEC §1（3 枠テンプレ・
つまずき欄＋状態は追記済み bce09ee）、proposals 18:12（ローカル自動保存）、
16:12（文化の文言）。タグの**入力 UI** は SPEC 実装順④の番なので作らないが、
保存形式には tags の欄を最初から持たせる（後から形を変えない）。

### 段階割り（1 段階 = ③の 1 周）

- **段階 A: Story の store＋単体試験**（`server/lib/stories.mjs`・
  `server/stories.test.mjs`・`"stories:test"`）
  - create / update / get / listPublic（新着順）/ listMine（下書き含む）
  - id は乱数 slug（投稿者に選ばせない。推測列挙と衝突を避ける）。
    原子的書き込み（tmp→rename）。削除は「記録は本人のもの」の文化上
    必須だが、アカウント退会と一緒に扱う後の段階へ（理由を残す)
- **段階 B: API 追加**（api.mjs に 5 経路＋試験）
  - POST `/api/stories`（要ログイン・作成）
  - PUT `/api/stories/<id>`（要ログイン・本人のみ更新。公開/下書き切替を含む）
  - GET `/api/stories.json`（公開のみ・新着順・ページ送り）
  - GET `/api/stories/<id>.json`（公開のみ。下書きは本人のみ）
  - GET `/api/mine/stories`（要ログイン・下書き含む）
- **段階 C: 投稿画面 `/write`**（ブラウザ実物確認まで）
  - 3 枠テンプレの挿入ボタン／つまずき欄＋未解決・解決／使ったツール欄／
    GAMEYARD URL 欄／公開・下書きの選択
  - **localStorage 自動保存**（送信前の控え。投稿成功で消す。proposals 18:12）
  - 文言に「完成していなくていい・数字で競わない・使ったツールは普通に書く」
    （proposals 16:12 をフォーム上部の 1 行に圧縮）

### データモデル（data/stories/<id>.json）

designs 14:22 の形をそのまま使う。上限を確定:
タイトル 120 字 / 本文 20,000 字 / tools 各 50 字×10 個 /
hurdle.text 200 字 / tags 各軸 5 個（17:12 の提案と同数） /
gameyardUrl は `https://play-game-yard.com/` 配下のみ（それ以外は保存しない）。
**画像は今回入れない**: 添付ファイルは検査（GAMEYARD は ClamAV 8 段階）を
伴う。CreatorYard に検査体制をどう持つかは運用の判断なので、検査なしの
アップロードを作って後から締める形にはしない（緩め始めない）。
SPEC の「任意の画像」は検査の持ち方が決まってから設計する

### 経路・画面

上記段階 B・C のとおり。読む側（一覧・個人ページ）は SPEC 実装順③で別設計

### 試験計画

- 段階 A: 作成→取得 / 本人以外の更新拒否 / 上限超過の拒否 / 下書きは
  listPublic に出ない / gameyardUrl の許可判定
- 段階 B: API 経由の作成→公開→一覧掲載の流れ / 認証なし 401 /
  他人の story 更新 403 / 下書きの secrecy（他人から 404）
- 段階 C: ブラウザで下書き保存→再読み込みで自動保存が残る→公開まで
- 毎段階 lint・build（静的）・既存試験が緑

### セキュリティ（脅威と対策）

- 認可: 更新・下書き閲覧は Bearer 検証済みの本人のみ（authorId 照合）
- 入力: すべてプレーンテキストとして保存し、表示側でエスケープ（HTML を
  解釈しない）。上限は上記で固定（**後から緩めるのは人の判断**）
- リンク: gameyardUrl は GAMEYARD オリジンのみ。一般の外部 URL を本文外の
  欄として持たない（リンクスパムの面を作らない。本人の収益リンクは
  プロフィール実装時の別論点）
- id 乱数 slug で下書きの存在を推測されない（403 でなく 404 を返す）
- 計測なし（閲覧数を保存しない）・ランキングなし・依存追加なし

## 2026-08-08 17:22 JST アカウント段階 C の詳細（画面＋API の CORS 補正）— 状態: 実装済み 66db774（ブラウザ実物確認済み。**アカウント A/B/C 全段階完了**）

段階 C（/register・/login）の実装前に、流用元の実物を確認して 2 点を確定する。

### 16:22 からの補正: CORS は「付けない」ではなく GAMEYARD と同型にする

GAMEYARD の api.mjs は `Access-Control-Allow-Origin:
process.env.SCAN_API_ORIGIN ?? '*'` と OPTIONS preflight を実装している
（本体と API が別オリジンの構成が前提。トークンを localStorage に置く理由も
scan-client.ts のコメントに「別オリジンでは cookie の SameSite の扱いが
面倒になるため」と明記）。16:22 の「CORS ヘッダは付けない」は流用元と
食い違い、開発時（next dev :3000 → api :3010）のブラウザ確認も通らない。
**`WRITE_API_ORIGIN ?? '*'` の同型に改める**（Bearer 方式で cookie を
使わないため、credentials なしの CORS は流用元と同水準の露出）。
本番でオリジンを固定するのは環境変数の設定＝運用であり、コードの判断ではない。

### 変更対象ファイル

1. `server/api.mjs` — CORS ヘッダ＋OPTIONS 対応（GAMEYARD 同型）
2. `server/api.test.mjs` — preflight と CORS ヘッダの試験を追加
3. `lib/write-api.ts`（新規）— `NEXT_PUBLIC_WRITE_API ?? ''` を基底 URL に、
   register/login/me とトークンの保存（localStorage、鍵 `cy.token`）。
   基底が未設定なら「書く機能は準備中」と正直に返す（GAMEYARD の
   「設定されていません」方式）
4. `app/register/page.tsx`・`app/login/page.tsx`（新規・client component）—
   ハンドル＋パスワードの 2 項目のみ。文言に「メールは不要（あとから設定
   でき、用途はパスワード再設定だけ）」を明記（proposals 15:12・隠さない文化）

### データモデル

変更なし（data/users はそのまま）

### 経路・画面

- `/register/`・`/login/` は静的書き出しに含まれる（client component なので
  export で問題ない）。API 未設定のビルドでは「準備中」を表示
- 成功時は `/login/` → 簡単な「ログイン中: <handle>」表示（me の確認を兼ねる。
  専用のマイページは Story 実装の番で）

### 試験計画

- api.test.mjs 追加分: OPTIONS が 204 相当で Allow ヘッダを返す /
  register 応答に Access-Control-Allow-Origin が付く
- `npm run lint`・`npm run build`（静的）・auth/api 試験が緑
- **ブラウザ実物確認**: `npm run api` ＋
  `NEXT_PUBLIC_WRITE_API=http://localhost:3010 npm run dev` で
  登録→ログイン→「ログイン中」表示まで通す

### セキュリティ（脅威と対策）

- CORS は上記のとおり流用元と同水準（credentials なし・Bearer のみ）。
  16:22 の他の決まり（8KB 上限・nosniff・バックオフ一元化）は変えない
- トークンは localStorage（流用元と同じ選択・理由もコメントで引き継ぐ）。
  XSS への土台対策は「第三者 JS なし・入力のエスケープ」のまま
- パスワードは type=password・autocomplete 属性を正しく付ける
  （new-password / current-password）。値をログ・URL に出さない
- 検査・認証・上限を緩めない。依存追加なし。計測なし・決済なし

## 2026-08-08 16:22 JST アカウント段階 B の改訂（単独 API サーバー方式）— 状態: 実装済み b516fea（api:test 8 件緑。次は段階 C: 画面）

15:22 の段階 B（Next Route Handlers＋httpOnly cookie 案）を**着手前に改訂**する。
理由は 2 つ。(1) このリポジトリの既定ビルドは `output: 'export'`
（next.config.mjs 確認済み）で、POST の Route Handler は静的書き出しと
衝突する。(2) 流用元 GAMEYARD の実物（`server/api.mjs`）は **Next とは別の
単独 node:http サーバー＋Bearer トークン**であり、cookie を使っていない。
静的ホスティングの安さとサーバー検査の両立のための分離、という設計意図も
コメントに明記されている。流用元と同構成に合わせる。

### 変更対象ファイル（段階 B）

1. `server/api.mjs`（新規）— node:http の単独サーバー。依存追加なし
2. `server/api.test.mjs`（新規）＋ package.json に
   `"api:test": "node --test server/api.test.mjs"`
3. `.gitignore` — `data/` と `.auth-secret` を追加（④の申し送り。実装より先に）

### 経路（段階 B で作るのは 4 本だけ）

| 経路 | 内容 |
| --- | --- |
| GET `/api/health` | 死活。UI が事前確認に使う |
| POST `/api/auth/register` | 登録（handle・password の 2 項目。proposals 15:12） |
| POST `/api/auth/login` | ログイン。`{ token, expiresAt, account }` を返す |
| GET `/api/auth/me` | Bearer トークンの確認 |

- 認証は `Authorization: Bearer <token>`（GAMEYARD の authenticate() と同じ）。
  cookie を使わないので CSRF はブラウザの自動送信経由では成立しない
- 画面（段階 C）は**静的ページ＋fetch** で API を叩く（GAMEYARD と同型。
  server モードの Next は MVP では使わない）。`npm run build` は静的のまま緑

### データモデル

段階 A の `data/users/<handle>.json` をそのまま使う（変更なし）

### 試験計画

- api.test.mjs: 一時ポートで起動し fetch で叩く。登録→ログイン→me の流れ /
  重複登録 409 / 誤パスワード 401（文言が不在時と同一）/ me の署名改ざん 401 /
  JSON でない body・大きすぎる body の拒否
- `npm run lint`・`npm run build`（静的）・`auth:test` が緑のまま

### セキュリティ（脅威と対策）

- body は JSON のみ・上限 8KB（読み過ぎない。上限は後から緩めない）
- Content-Type 検査。応答は application/json 固定＋`X-Content-Type-Options: nosniff`
- 失敗の指数バックオフ・列挙対策は段階 A の Accounts をそのまま通す
  （API 層で二重に文言を作らない。clientKey にはソケットのアドレスを渡す）
- CORS ヘッダは付けない（同一オリジン配信が前提。付けるときは人の判断）
- トークンの保存先（ブラウザ側）は段階 C の論点として明記して先送りしない
  ＝ localStorage（GAMEYARD と同じ）。XSS 対策は「第三者 JS を入れない・
  本文のエスケープ」という土台の決まりで受ける
- 検査・認証・上限を緩めない。依存追加なし。決済・計測なし

## 2026-08-08 15:22 JST アカウント（SPEC 実装順①）— 状態: 段階 A 実装済み 16b3edf（auth:test 8 件緑。次は段階 B: API）

出典: 調停 14:50 の指示（決定済みの実装順を優先）＋ proposals 15:12
（登録 2 項目・メール後から）。流用元: GAMEYARD `server/lib/auth.mjs`
（読み取り済み。scrypt・署名トークン・自前実装・依存追加なし）。

### 段階割り（1 段階 = ③の 1 周に収まる大きさ）

- **段階 A: 認証の中核ライブラリ＋単体試験**（次の③）
  - `server/lib/auth.mjs` を GAMEYARD から移植し、CreatorYard に不要な
    部分（連絡先自由記述など）を落とす。`server/auth.test.mjs` ＋
    package.json に `"auth:test": "node --test server/auth.test.mjs"`
  - 流用する決まり: scrypt（N=16384, r=8, p=1, keylen=64, maxmem 明示）、
    salt 32B、timingSafeEqual、ハンドル `^[a-z0-9][a-z0-9_-]{2,31}$`、
    パスワード 10〜200 字、署名トークン TTL 30 日、AUTH_SECRET は
    環境変数か 0600 のファイル、ログイン失敗の追跡上限（メモリを
    攻撃面にしない）
- **段階 B: 登録・ログイン・ログアウトの API**（その次の③）
  - Next Route Handlers（`app/api/auth/register|login|logout`）。
    **server モードのみ**（静的側には存在しない。SPEC §3「書く側だけ軽い API」）
  - cookie は httpOnly ＋ SameSite=Lax ＋（本番）Secure。CSRF は
    SameSite＋POST 限定＋Origin 確認で始める（GAMEYARD と同水準）
- **段階 C: 画面**（さらに次の③。ブラウザで実物確認まで）
  - `/register` `/login` 最小フォーム（登録はハンドル＋パスワードの
    2 項目だけ。proposals 15:12）。メールは設定画面で後から任意登録
    （設定画面自体は Story 実装後でよい）

### 変更対象ファイル

段階 A: `server/lib/auth.mjs`（新規・移植）, `server/auth.test.mjs`（新規）,
`package.json`（scripts に auth:test。依存追加はしない）
段階 B: `app/api/auth/*/route.ts`（新規）
段階 C: `app/register/page.tsx`, `app/login/page.tsx`（新規）

### データモデル（ファイル保存。DB なし）

```jsonc
// data/users/<handle>.json（原子的書き込み。GAMEYARD の store 方式）
{
  "handle": "…",                 // 一意キー＝ファイル名
  "password": { "salt": "…", "hash": "…", "kdf": "scrypt", "N": 16384, "r": 8, "p": 1, "keylen": 64 },
  "email": "",                   // 任意。登録時は常に空。用途はパスワード再設定のみ
  "createdAt": "…"
}
```

### 経路・画面

- POST `/api/auth/register` / `/api/auth/login` / `/api/auth/logout`
  （server モードのみ。静的ビルドには含めない）
- `/register` `/login`（段階 C）。文言に「メールは不要。後から設定でき、
  用途はパスワード再設定だけ」を明記（隠さない文化）

### 試験計画

- 段階 A: 登録→検証が通る / 誤パスワードが落ちる / ハンドル形式違反・
  重複が落ちる / トークンの署名改ざんが落ちる / TTL 切れが落ちる
- 段階 B: API 経由の登録→ログイン→ログアウトの流れ（flow 試験の原型）
- 段階 C: ブラウザで実物確認（登録→ログイン→cookie 確認）
- 毎段階 `npm run lint`＋`npm run build` 緑を維持（静的ビルドに
  server 専用物が混ざっていないことの確認を兼ねる）

### セキュリティ（脅威と対策）

- パスワード総当たり → scrypt（鍵導出関数）＋失敗追跡（上限つき）。
  単純ハッシュにしない
- セッション偽造 → 署名トークン（AUTH_SECRET 32 文字以上 or 0600 ファイル）、
  timingSafeEqual、httpOnly cookie
- CSRF → SameSite=Lax＋POST 限定＋Origin 確認
- 列挙 → ログイン失敗時に「ハンドルが存在するか」を応答で区別しない
- メール到達確認は入れない（GAMEYARD の決定を引き継ぐ。連絡先が本人の
  ものである保証はなく、再設定は本人が正しく書いた場合だけ有効）。
  メール未登録での復旧は「再設定不可」と画面に先に明示（HN 型の
  運営窓口は Discord 開設後に検討 = 人待ち側）
- SMTP は未設定のまま始める（GAMEYARD 同様「使えない」と正直に答える）。
  CreatorYard 用 SMTP を用意するかは公開準備時の社長判断
- 検査・認証・上限を緩めない。依存追加なし。個人計測なし・決済なし

## 2026-08-08 14:22 JST Story の書式「3 枠テンプレ＋つまずきの解決状態」— 状態: 実装済み bce09ee（SPEC 追記分。フォーム・store は Story 実装の番で）

出典: proposals.md 2026-08-08 14:12（事例 1・2）。コードはまだ無い段階なので、
**今回③が実装するのは SPEC.md への書式追記のみ**（文書 commit）。フォームと
store は Story 実装（SPEC の実装順②）の番でこの設計に従う。

### 設計の骨子

- **保存形式は変えない。** 本文はプレーンテキスト 1 フィールドのまま。
  3 枠テンプレ（やったこと / つまずいたこと / 次の一歩）は投稿フォームの
  **挿入補助**（見出し行を本文に挿し込むボタン）であって、構造化しない。
  理由: 「装飾なし・自由文」の敷居の低さを守る。構造化すると空欄が
  義務に見える（Zenn スクラップの気軽さと逆行する）
- **つまずきに状態を持たせる。** Story 単位で任意の「つまずき」欄
  （短文）＋「未解決 / 解決」の状態。既定は未解決。本人だけが切り替える

### 変更対象ファイル（今回③の分）

1. `SPEC.md` §1 の表 — 「Story を書く」に 3 枠テンプレ（挿入補助・任意）を、
   「つまずきタグ」につまずき欄＋未解決/解決の状態を追記

### データモデル（Story 実装時の store 形式。ファイル保存・DB なし）

```jsonc
// data/stories/<id>.json（GAMEYARD の store 方式に合わせる）
{
  "id": "SAFE_SLUG",
  "authorId": "…",
  "title": "…",
  "body": "プレーンテキスト＋改行",
  "tools": ["…"],                    // 使ったツール欄（隠さない文化）
  "tags": { "tool": ["…"], "topic": ["…"] },  // つまずきタグ 2 軸
  "hurdle": { "text": "…", "status": "open" }, // 任意。open | resolved
  "gameyardUrl": "…",                // 任意。手動リンク
  "visibility": "public",            // public | draft
  "createdAt": "…", "updatedAt": "…"
}
```

### 経路・画面（Story 実装時）

- 投稿フォーム（server モードのみ）: テンプレ挿入ボタン 3 つ＋つまずき欄＋状態
- Story ページ: つまずきがあれば「つまずき: 未解決 / 解決」を表示
  （件数の集計・公開カウンタは作らない）
- 一覧の絞り込み（未解決のつまずき）は MVP 後に判断

### 試験計画

- 今回③: `npm run lint` と `npm run build` が緑のまま（文書変更のみの確認）
- Story 実装時: テンプレ挿入が本文を壊さない / hurdle 無しでも保存できる /
  状態の既定が open / 下書き→公開で hurdle が保持される / 本人以外は
  状態を変更できない

### セキュリティ（脅威と対策）

- 本文・つまずき欄はプレーンテキストとして扱い、表示時にエスケープ
  （HTML/スクリプト挿入を通さない）。テンプレ挿入はフォーム内の文字列操作
  だけで第三者 JS を使わない
- 状態変更は認証済み本人のみ（GAMEYARD 流用の自前認証。緩めない）
- 解決数・未解決数の公開カウンタは作らない（数字を競争にしない）。
  個人単位の行動計測もしない
- 検査・認証・上限の変更なし。依存追加なし。決済なし

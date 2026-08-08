# 技術設計（役割②の出力）

役割②が proposals.md の最新（または調停の指示）を設計に落とす。新しいものを上に。
役割③はここの最新の「未実装」を実装し、済んだら「実装済み <hash>」と印を付ける。

必須の節: 変更対象ファイル / データモデル / 経路・画面 / 試験計画 /
**セキュリティ（脅威と対策。検査・認証・上限は緩めない。第三者 JS なし・
個人単位の行動計測なし・決済なしを壊さない）**

---

## 2026-08-08 16:22 JST アカウント段階 B の改訂（単独 API サーバー方式）— 状態: 未実装

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
- 検査・認証・上限を緩めない。依存追加なし。決済・計測なし アカウント（SPEC 実装順①）— 状態: 段階 A 実装済み 16b3edf（auth:test 8 件緑。次は段階 B: API）

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
- 検査・認証・上限を緩めない。依存追加なし。個人計測なし・決済なし Story の書式「3 枠テンプレ＋つまずきの解決状態」— 状態: 実装済み bce09ee（SPEC 追記分。フォーム・store は Story 実装の番で）

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

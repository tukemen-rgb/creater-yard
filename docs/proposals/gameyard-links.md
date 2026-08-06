# 提案: GAMEYARD 内導線（ACQUISITION A2 — 優先順位 1）

2026-08-06 起草。**これは提案（判断材料）**。適用は GAMEYARD 側
（`tukemen-rgb/site`）の作業なので、社長の GO と GAMEYARD セッションへの
指示で動く。CreatorYard の URL が未定でも先に入れられる形にしてある。

## なぜ最初にやるか

ACQUISITION の結論どおり「いる人を逃さない。実装だけで効く」。
GAMEYARD には既に**ゲームを作って投稿する人**が来ている。その人たちが
CreatorYard の最初の書き手になる。外に広告を出す前に、目の前の導線。

## 方式: URL は環境変数で入れる（Discord と同じ型）

GAMEYARD には `NEXT_PUBLIC_DISCORD_URL`（`site.config.mjs` の
`discordUrl`。URL が入るまでリンクを出さない）という型が既にある。
同じ型で `NEXT_PUBLIC_CREATORYARD_URL` を追加すれば、**ドメイン決定前に
コードを入れておき、決定した日に env を設定するだけで導線が生える**。

```js
// site.config.mjs（discordUrl の隣に）
creatoryardUrl: (process.env.NEXT_PUBLIC_CREATORYARD_URL ?? '').trim(),
```

## 挿し込み場所と文言（3 か所・すべて 1〜2 行）

### 1. フッター「投稿する」の列（components/SiteChrome.tsx SiteFooter）

「素材ライブラリ」の下に 1 行:

```
制作の記録を残す（CreatorYard）
```

### 2. 投稿完了画面（components/UploadForm.tsx「公開しました。」の後）

「作品ページを開く」ボタンの並びに、控えめなリンクで:

```
制作の記録も残しませんか — つまずきも工夫も、次に作る人の近道になります（CreatorYard）
```

投稿直後は「語りたいこと」が一番多い瞬間。ここだけは文言を厚めにする。

### 3. devlog 編集画面（components/DevlogEditor.tsx の説明文の末尾）

devlog を書く人＝制作記録を書く習慣がある人。1 行だけ:

```
更新履歴より長い記録は CreatorYard へ（作品ページから相互リンクできます）
```

## やらないこと（先に線を引く）

- **自動転載・共通アカウントは作らない**（SPEC §1 で「後」と決定済み。
  手動リンクで需要を見るのが先）
- ポップアップ・モーダルでの誘導はしない（GAMEYARD の利用体験を
  損なってまで送客しない。姉妹サービスであって広告主ではない）
- 検索資産（既存ページの URL・構造）には触らない（D-CY2）

## 適用手順（GAMEYARD セッション向け）

1. `site.config.mjs` に `creatoryardUrl` を追加
2. 上記 3 か所に `siteConfig.creatoryardUrl` が空でないときだけ出る
   リンクを追加（discordUrl と同じ条件分岐の型）
3. lint・両モードビルド・実画面で確認、GAMEYARD の Issue #1 に報告
4. ドメイン決定後、本番 env に `NEXT_PUBLIC_CREATORYARD_URL` を設定して
   再ビルド（GAMEYARD は静的優先なのでビルドが要る）

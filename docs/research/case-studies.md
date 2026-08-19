# 事例データベース（他社・市場）

役割①（調査・提案）が毎時追記する。**出典つきで確かめられた事例だけを数える。**
数を埋めるための推測・創作は書かない。累積 100 件以上が目標。新しいものを上に。

書式:

## <番号>. <事例名>
- 出典: <URL>（確認日）
- 事実: <確かめられたことだけ>
- 学び: <CreatorYard にどう効くか（書き手の体験 / 人が集まり残るか の観点）>

---

## 86. **NN/g —— 「いま何が起きたか」を伝えないと、信用が積み上がらない**

- 出典: <https://www.nngroup.com/articles/ten-usability-heuristics/>
  （Nielsen Norman Group「10 Usability Heuristics」#1 Visibility of System Status／
  **2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time.`**
  >
  > **`When users know the current system status, they learn the outcome of their prior interactions and determine next steps. Predictable interactions create trust in the product as well as the brand.`**

- 学び: 2026-08-20 に U-13 で「**保存できたかを返す**」形に変えた。
  返すようにしただけでは足りない —— **受け取らなければ、黙って捨てるのと同じ**である。
  実際に数えたら、**受け取っていない呼び出しが 3 か所**残っていた（下の提案 U-15）。
  いちばん効くのは**ヒアリングを終えた匿名の人の 4 つの答え**で、
  **保存できなくても画面は何も言わずに登録へ送る。**

  この事例が言う「`the outcome of their prior interactions`」は、
  **この製品では「書いたものが残ったかどうか」**にあたる。

---

## 85. **NN/g —— 手がかりが弱い面から、人は「次」へ行かずに去る**

- 出典: <https://www.nngroup.com/articles/information-scent/>
  （Nielsen Norman Group「Information Scent」／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`The information scent of a source of information (such as a webpage) relative to an information need represents the user's imperfect estimate of the value that the source will deliver to the user.`**
  >
  > 手がかりが足りない面について:
  > **`users don't bother scrolling anymore in search of the right information, nor do they click on any visible link: they quickly decide that the page is not worth exploring any longer and simply leave.`**

- 学び: **「リンクが在る」ことと「次が見える」ことは別**である。
  CreatorYard の Story の面を `origin/main` で数えたら、**読み終えた人に
  差し出している最後のリンクは「この Story の問題を通報する」1 本だけ**だった
  （書いた本人にだけ「その後を書く」が出る）。**招かれた人が最初に開くのは
  たいてい Story の直リンク**なので、**この面が「次」を持っていないことは
  そのまま撤退条件に効く。**下の提案 U-14。

---

## 84. **MDN —— `localStorage` は「読むだけ」でも例外を投げることがある**

- 出典: <https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage>
  （MDN Web Docs「Exceptions」／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`SecurityError` … Thrown in one of the following cases:**
  > **`The origin is not a valid scheme/host/port tuple. This can happen if the origin uses the file: or data: schemes, for example.`**
  > **`The request violates a policy decision. For example, the user has configured the browsers to prevent the page from persisting data.`**
  >
  > **`Note that if the user blocks cookies, browsers will probably interpret this as an instruction to prevent the page from persisting data.`**

- 学び: **「保存できない」ではなく「触っただけで落ちる」**のが要点。
  CreatorYard の `lib/api.ts` は `window.localStorage` を**囲わずに**触っている。
  同じ repo の `lib/story-interview.ts` と `lib/saved-stories.ts` は
  **`try`/`catch` で囲っている** —— **同じ製品の中で扱いが分かれている。**

  囲っていないほうを呼ぶのが `components/nav-auth.tsx`（**ヘッダー＝全ページ**）で、
  描画後の `useEffect` の中である。**cookie を全部拒否している人には、
  全ページで落ちうる。**（Safari の「サイト越えトラッキングを防ぐ」は
  1st party の `localStorage` を止めないので、これに当たるのは**明示的に
  保存を拒否している人**である。**少数だが実在する。**）

---

## 83. **MDN —— Safari は、7 日来ない人の保存領域を消す**

- 出典: <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
  （MDN Web Docs／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`Browsers can store up to 5 MiB of local storage, and 5 MiB of session storage per origin.`**
  >
  > **`Once this limit is reached, browsers throw a QuotaExceededError exception …`**
  >
  > **`Safari proactively evicts data when cross-site tracking prevention is turned on. If an origin has no user interaction, such as click or tap, in the last seven days of browser use, its data created from script will be deleted. Cookies set by server are exempt from this eviction.`**

- 学び（**事例 82 と正面からぶつかる。両方を並べて書く**）:

  82 は「`localStorage` に**期限は無い**」と言い、83 は「Safari では **7 日**で
  消えうる」と言う。**どちらも正しい** —— 仕様に期限が無いことと、
  ブラウザが消さないことは別である。**CreatorYard にとっては後者が効く。**

  この製品が端末に置いているのは 5 つで、**Safari ではその全部が対象になる**
  （サーバーが立てた cookie は除外だが、**この製品は cookie を使っていない**）。

  | 消えると何が起きるか |
  | --- |
  | `cy-token` `cy-handle` … **ログインが切れる**（7 日来なければ） |
  | `cy-saved-story-ids` … **「あとで読む」が空になる** |
  | `creatoryard:story-interview-draft` … **書きかけが消える** |

  **招かれた人が iPhone でヒアリングを途中まで書き、8 日後に戻ってくると、
  書きかけは無い。**これは不具合ではなく、**Safari の既定の動き**である。

  **5 MiB のほうも効く** —— 「あとで読む」は ID（8 文字）を最大 50 本なので
  **1 KB に満たない。上限 50 は、容量の話ではない**（＝**製品としての判断**であって、
  技術の制約ではない。社長の未決 1 件ぶんの材料）。

---

## 82. **MDN —— `localStorage` は期限が無い。閉じても消えない**

- 出典: <https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage>
  （MDN Web Docs／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`localStorage is similar to sessionStorage, except that while localStorage data has no expiration time, sessionStorage data gets cleared when the page session ends — that is, when the page is closed.`**
  >
  > **`(localStorage data for a document loaded in a "private browsing" or "incognito" session is cleared when the last "private" tab is closed.)`**

- 学び: CreatorYard は**書きかけの本文**を `localStorage` に置いている
  （`creatoryard:story-interview-draft`。ヒアリングから書く道）。
  **期限が無いということは、共有の端末では次に座った人のブラウザにも残る**
  という意味である（私用の窓で開いた場合を除く）。
  **これは「消し忘れ」ではなく仕様どおりの挙動**なので、
  **消す仕掛けか、残ると書くか、どちらかが要る。**
  いま `/data-policy/` は**端末に残るものを 1 つも書いていない**
  （2026-08-20 に①が数えた。下の提案）。

---

## 81. **Google —— canonical は「お願い」であって命令ではない**

- 出典: <https://developers.google.com/search/docs/crawling-indexing/canonicalization>
  （Google Search Central「Canonicalization」／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`You can indicate your preference to Google using these techniques, but Google may choose a different page as canonical than you do`**
  >
  > **`indicating a canonical preference is a hint, not a rule`**

  同じ文書は、同じ中身が複数の URL に並ぶ原因の 1 つとして
  **`Protocol variants: for example, the HTTP and HTTPS versions of a site`**
  を挙げている。

- **確かめられなかったこと（書かない）**: **`www.` の有無**については、
  この文書は**名指しで触れていない。**①は「www と非 www は重複として扱われ、
  片方へ寄せるべき」という材料を探したが、**この一次資料からは取れなかった。**
  **だから「取れなかった」と書く。**別の資料で裏が取れるまで、
  `www.` の判断材料としては数えない。

- 学び: 2026-08-20 に、本番の `/` に `canonical` が無いことを見つけて直した
  （PR #70）。**その価値をここで正しく見積もっておく** —— canonical は
  **希望を伝える手段**であって、検索側がそのとおりにするとは限らない。
  **「canonical を入れたから大丈夫」とは書かない。**
  逆に言えば、**入れないと希望を伝える手段が 1 つも無い**。

---

## 80. **Open Graph protocol —— `og:image` は「必須の 4 つ」の 1 つ**

- 出典: <https://ogp.me/>（Open Graph protocol／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`The four required properties for every page are:`**
  > **`og:title` — `The title of your object as it should appear within the graph`**
  > **`og:type` — `The type of your object`**
  > **`og:image` — `An image URL which should represent your object within the graph`**
  > **`og:url` — `The canonical URL of your object …`**

  **仕様は「無いとどうなるか」を書いていない。**（だから**推測しない**。
  下は実物を数えた結果だけ）

- 実物を数えた（2026-08-20・本番と `main` の両方）:

  | 面 | 出ている og | `og:image` |
  | --- | --- | --- |
  | トップ・一覧・タグなど | `title` `type` `site_name` `locale` `description`（＋`url`） | **無し** |
  | 記事（画像を貼っていない Story） | 同上 ＋ `url` | **無し** |
  | 記事（画像を貼った Story） | 同上 | **在る**（`CY_SITE_ORIGIN` が要る） |

  つまり**必須 4 つのうち 3 つは全面にあり、`og:image` だけが
  「画像を貼った記事」にしか無い。**

- 学び: **これは「壊れている」ではなく「決まっていない」。**
  `lib/og.ts` の註釈にこう書いてある ——「**無い URL を指すより、出さない
  ほうがまし**（2026-08-09 に `og:image` で決めたのと同じ理屈）」。
  **既定の画像を作るかどうかが、社長待ちの 1 件**（「`og:image` を作るか」）。

  招待は**リンクを貼って送る**形になるので、**貼られたときの見え方**は
  招待の直前に効く。ただし**作る／作らないは社長の決定**であり、
  ①としては「**必須 4 つのうち 1 つが欠けている**」という事実だけを置く。

---

## 79. **Google 検索セントラル「noindex」—— 見てもらうには、まず来てもらう必要がある**

- 出典: <https://developers.google.com/search/docs/crawling-indexing/block-indexing>
  （Google Search Central／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`For the noindex rule to be effective, the page or resource must not be`**
  > **`blocked by a robots.txt file, and it has to be otherwise accessible to the`**
  > **`crawler.`**

  > **`There are two ways to implement noindex: as a <meta> tag and as an HTTP`**
  > **`response header. They have the same effect.`**

  > **`Depending on the importance of the page on the internet, it may take months`**
  > **`for Googlebot to revisit a page.`**

- 学び（この場所に効くこと 3 つ）:
  1. **`robots.txt` で塞がない判断は正しかった。**`public/robots.txt` は
     `Allow: /` のままで、「robots.txt で止めると crawler が noindex を
     読みに来られない」と註釈に書いてある。**一次資料がそれを裏づけた。**
  2. **いまは `<meta>` で `noindex, nofollow`**（`app/layout.common.tsx`）。
     HTTP ヘッダでも同じ効果、と明記されている —— **2 通りある**ので、
     **片方だけ外してもう片方が残る事故**がありうる。
     **数えた（2026-08-20）: この場所は `<meta>` の 1 か所だけ。**
     `X-Robots-Tag` は `deploy/` にも `server/` にも無く、**本番の応答
     ヘッダにも無い**（`curl -I` で確認）。**外すときに触るのは 1 か所。**
  3. **外したあと、すぐには載らない。**「重要度によっては**数か月**かかる
     ことがある」と書いてある。**noindex を外す判断は、外した日に効果が
     出る類のものではない。**招待や反映より**前倒しで決める理由はないが、
     決めたら早いほうがよい**、という性質のもの

- **この事例は判断材料であり、判断ではない。**noindex を外すかどうかは
  社長の決定（人が決めるまで変えない一覧）。

---

## 78. **WCAG 2.2 SC 2.5.8 Target Size (Minimum) —— 24×24。ただし文中のリンクは対象外**

- 出典: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
  （W3C Web Accessibility Initiative／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`The size of the target for pointer inputs is at least 24 by 24 CSS pixels, except when:`**

  例外のうち、この場所に効くのは 2 つ:

  > **`Spacing: Undersized targets … are positioned so that if a 24 CSS pixel diameter`**
  > **`circle is centered on the bounding box of each, the circles do not intersect`**
  > **`another target …`**

  > **`Inline: The target is in a sentence or its size is otherwise constrained by the`**
  > **`line-height of non-target text`**

- 学び: 2026-08-20 に①がスマホの画面（390×664）で通しで歩いたところ、
  **主要操作は完了し、横のはみ出しは 0** だった。ただし**高さ 44px 未満の
  押しどころ**が各面に 1〜4 個あった（16〜20px）。
  **その大半は「文中のリンク」**（`RSS で受け取れます`・`タグから探す`・
  `その後を書く`）で、**上の `Inline` 例外に当たる。**
  この場所は既に、**並んだ導線には 44px を当てている**
  （`auth-panel__links a` ・ `pager a` ・ `voice-input__note`）。
  **規格違反ではない。**ただし `その後を書く` のように**次の行動を促す導線**は、
  文中であっても指で押しやすいほうがよい —— **これは好みなので提案止まり。**

---

## 77. **MDN `SpeechRecognition` —— ブラウザによっては、音声はサーバーへ送られる**

- 出典: <https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition>
  （MDN Web Docs／**2026-08-20 に①が取得して確認**）
- 事実（原文の表現）:

  > **`On some browsers, like Chrome, using Speech Recognition on a web page`**
  > **`involves a server-based recognition engine. Your audio is sent to a web`**
  > **`service for recognition processing, so it won't work offline.`**

- 学び: CreatorYard の「音声で入力」は、この API をそのまま使っている
  （`components/voice-input.tsx`。**第三者の JS は 1 つも読み込んでいない**）。
  つまり**うちは音声を受け取らない。**それでも、**書き手から見れば
  「声が外へ出るかどうか」が問題**である。
  2026-08-20 に①が数えたら、**ヒアリングの面だけが説明していて、書く面の
  同じボタン 2 つには何も書いていなかった**（`/data-policy/` にも記述なし）。
  **押す前に言う**ようにし、その一言を部品に持たせて
  **音声入力を置いた場所すべてに付いて回る**形にした（U-11・PR #64）。

---

## 76. **NN/g の 10 ヒューリスティクス #3・#5 —— 「取り消せること」と「起こる前に止めること」**

- 出典: <https://www.nngroup.com/articles/ten-usability-heuristics/>
  （Nielsen Norman Group／**2026-08-19 に①が取得して確認**）
- 事実（原文の表現）:

  #3 User Control and Freedom

  > **`Users often perform actions by mistake. They need a clearly marked`**
  > **`"emergency exit" to leave the unwanted action without having to go`**
  > **`through an extended process.`**

  同項の助言に `Support Undo and Redo` が挙がっている。

  #5 Error Prevention

  > **`Good error messages are important, but the best designs carefully prevent`**
  > **`problems from occurring in the first place. Either eliminate error-prone`**
  > **`conditions, or check for them and present users with a confirmation option`**
  > **`before they commit to the action.`**

  助言に `Prioritize your effort: Prevent high-cost errors first` と
  `Prevent mistakes by removing memory burdens, supporting undo, and warning your users`。

- 学び: CreatorYard の「あとで読む」は、**51 本目を押した瞬間に 1 本目が消える**
  （2026-08-19 に①が実物で確認）。押した人には**取り消す手段も、起きたという
  知らせも無い**。#5 の言う `warning your users` が 1 行も無い状態で、
  #3 の言う `emergency exit` も無い。**上限そのものを動かす必要は無い** ——
  起きることを先に言えば、#5 の `present users with a confirmation option`
  に届く。

---

## 75. **WCAG 2.2 SC 3.3.4 —— 「消える操作」は、戻せるか・確かめられるか・確認できるかのどれかであること**

- 出典: <https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html>
  （W3C Web Accessibility Initiative／**2026-08-19 に①が取得して確認**）
- 事実（原文の表現）:

  > **`For web pages that cause legal commitments or financial transactions for`**
  > **`the user to occur, that modify or delete user-controllable data in data`**
  > **`storage systems, or that submit user test responses, at least one of the`**
  > **`following is true:`**
  >
  > **`Reversible - Submissions are reversible.`**
  > **`Checked - Data entered by the user is checked for input errors and the`**
  > **`user is provided an opportunity to correct them.`**
  > **`Confirmed - A mechanism is available for reviewing, confirming, and`**
  > **`correcting information before finalizing the submission.`**

  「user-controllable data」について:

  > **`When referring to modification or deletion of "user controllable" data,`**
  > **`the intent is to prevent mass loss of data such as deleting a file or record.`**

- **正直に書く**: この基準が名指ししているのは**サーバー側のデータ保管**での
  削除であり、CreatorYard の「保存した Story」は**端末のブラウザの中だけ**に
  ある（`lib/saved-stories.ts`。ID しか持たず、サーバーへ送らない）。
  **そのまま当てはまるとは言わない。**
- 学び: それでも「本人が作った並びが、本人の知らないうちに削られる」形は
  同じで、この基準が示す**3 つの逃げ道（戻せる／確かめる／確認する）**は
  そのまま道具として使える。うちの「あとで読む」は**3 つのどれも無い。**
  いちばん軽い `Confirmed`（押す前に「いっぱいです」と言う）だけでも、
  この形から外れる。

---

## 74. **NN/g「Visibility of System Status」—— 情報が無いことは、制御が無いことと同じ**

- 出典: <https://www.nngroup.com/articles/visibility-system-status/>
  （Aurora Harley・Nielsen Norman Group・2018-06-03 公開／**2026-08-19 に①が取得して確認**）
- 事実（原文の表現）:

  > **`How well the state of the system is conveyed to its users. Ideally, systems`**
  > **`should always keep users informed about what is going on, through appropriate`**
  > **`feedback within reasonable time.`**

  同記事はさらに、

  > **`A lack of information often equates to a lack of control.`**

  > **`The predictability of the interaction creates trust not only in the mechanics`**
  > **`of the site or the app, but also in the brand itself.`**

  と書いている。これは Nielsen の 10 ヒューリスティクスの **1 番目**である。

- 学び（**2 つ**）:

  **(1) 「正しく動いていること」と「動いていると伝わること」は別物である。**
  この事例が言っているのは**表示を足せ**ではなく、**利用者の側が状態を
  知らないと、自分に制御が無いと感じる**ということ。

  **CreatorYard で実際に当たっている場所がある。**①が 2026-08-19 に実物を
  歩いて測った ——**ヒアリングに 4 問答えた直後、`/signup/` へ送られる。
  答えは端末に保存されていて登録後に全部戻る（①が全文で確認）。
  ところが `/signup/` の画面には、それを伝える語が 1 つも無い**
  （「残」「保存」「消え」「戻」「下書き」「ヒアリング」「回答」の 7 語すべて不在）。

  **やっていることは正しい。伝えていないだけである。**しかし書き手の側から
  見れば、**いま書いた 4 つが消えるのかどうか確かめる手段が無い。**

  **(2) 信頼は「作り」ではなく「予測できること」から来る、という主張に注意する。**
  原文は `predictability` が brand への信頼まで作ると言っている。
  **これは CreatorYard が売りにしている性質そのもの**（数字で競わせない・
  勝手に計測しない）。**黙って正しくやる**のは、この場では**半分しか
  果たしていない。**

  **ただし、足すのは説明であって装飾ではない。**この事例を
  「進捗バーを付けよう」に使うのは読み違いである。**足りないのは、
  利用者がいま知りたい 1 つのこと**（＝書いたものは残るのか）だけ。

---

## 73. **GDPR 第 20 条「データポータビリティの権利」—— 消せることと、持ち出せることは別**

- 出典: <https://gdpr-info.eu/art-20-gdpr/>（`Art. 20 GDPR – Right to data portability`・2026-08-17 確認）
- 事実（原文の表現・第 1 項）:

  > **`The data subject shall have the right to receive the personal data concerning him or her,`**
  > **`which he or she has provided to a controller, in a structured, commonly used and`**
  > **`machine-readable format...`**

  続けて、**別の管理者へ妨げられずに移す権利**についても定めている。

- 学び（**3 つ。うち 1 つは①が作りかけた「無い問題」の記録**）:

  **(1) 法として当てはめる話ではない。**CreatorYard は日本のサービスで、
  **GDPR が直接効くわけではない。**事例 68（Stanford の「電話番号と物理住所を
  出せ」）と同じで、**規範は文脈ごと読む。**
  **①が引くのは「消せる」と「持ち出せる」が別物だという線引きだけ**である。

  **(2) CreatorYard は「消せる」側だけを持っている。**①が確かめた ——

  | | 在るか | どこに書いてあるか |
  | --- | --- | --- |
  | **消せる** | **在る** | `/guidelines/`「Story はいつでも消せます。退会すれば…全部消えます」 |
  | **持ち出せる** | **無い** | `git grep` で書き出し・持ち出し・エクスポートに当たるものは**ユーザー向けには 0 件** |

  **RSS は持ち出しの道ではない。**`server/lib/feed.mjs` に**そう書いてある**。

  > **`本文の冒頭だけを description に使う。全文は載せない（ページへ来てもらう）。`**

  実測でも `excerpt(body, max = 200)` で、**200 字まで**である。

  **これは欠陥ではない。**MVP は Creator Story のみで、**持ち出しは範囲外**である。
  **①は新機能を提案しない。**
  **ただし招待文に「持ち出せます」とは書けない**（棚卸しに 1 行足す）。

  **(3) ①が作りかけた「無い問題」の記録。**
  ①はこの周、**「30 日で撤退しうる場所に人を招くのに、記録がどうなるか書いていない」**
  という問題を立てかけた。**SPEC を読んだら、書いてあることが違った。**

  > **`公開から 30 日で「書き手 10 人・Story 30 本」に届かなければ、`**
  > **`機能追加を止めて原因を人に報告し、D-CY1 の再判断（B: 保留に戻す）を仰ぐ。`**

  **撤退条件は「閉じる」ではない。「機能追加を止めて、再判断を仰ぐ」である。**
  **閉じるとは、どこにも書いていない。**

  **危うく、書いていないことを問題にするところだった。**
  **④が 19:10 に「未確認と書く前に確かめる」と自分に課したのと同じ形で、
  ①は「問題だ」と書く前に原文を読んだ。**


## 72. **Paul Graham "Default Alive or Default Dead?" —— 「驚くのは、創業者自身が知らないことだ」**

- 出典: <https://paulgraham.com/aord.html>（Paul Graham・2015 年 10 月・2026-08-17 確認）
- 事実（原文の表現）:

  > **`The startling thing is how often the founders themselves don't know.`**
  > **`Half the founders I talk to don't know whether they're default alive or default dead.`**

  > **`instead of starting to ask too late whether you're default alive or default dead,`**
  > **`start asking too early.`**

  > **`it's probably not that dangerous to start worrying too early that you're default dead,`**
  > **`whereas it's very dangerous to start worrying too late.`**

  判定そのものは **`Assuming their expenses remain constant and their revenue growth is what it has been over the last several months, do they make it to profitability on the money they have left?`**

- 学び（**3 つ。うち 1 つは①の測り間違いの記録**）:

  **(1) CreatorYard は、PG が「半分は知らない」と言う数字を先に書いてある。**
  SPEC §4 の撤退条件 —— **30 日で書き手 10 人・Story 30 本**。
  **さらに、それを数える道具まで在る**（`scripts/tally.mjs`・PR #11）。
  **「知らない」側ではない。**

  **(2) しかし、時計が動いていない。**
  `scripts/tally.mjs` の冒頭にこう書いてある ——

  > **`判定日を引数にしているのは、「公開から 30 日」の起点（公開日か・`**
  > **`招待開始日か・noindex 解除日か）が社長の判断でまだ決まっていないため。`**
  > **`決定をコードに焼き込まない。`**

  **道具は在り、数字も決まっていて、起点だけが空いている。**
  PG は **`start asking too early`** と言うが、**いまは問い始めてすらいない。**
  **早すぎるほうが安全だ、というのが原文の主張である。**

  **(3) ①の測り間違い（報告前に気づいた）。**
  「記録に tally の出力が 1 度も出ていない」と書きかけて、`grep` したら
  `designs.md` に **`2026-08-14: 公開 Story 1 本 / 書き手 1 人`** が在った。
  **本番の実測かと思ったが、読んだら設計書の「出力例」だった。**

  **記録に残っている実行は 1 件だけで、それは④が PR #11 の監査で
  空の手元の書庫に当てたもの**（`公開 Story 0 本 / 書き手 0 人`）である。
  **本番のデータに当てた記録は 0 件。**

  **例を実測と読み違えるのは、今日 22 回数えた形と同じである** ——
  **見たものと、語ったものがずれている。**

## 71. **swyx "Learn in Public" —— 「いちばんの受益者は、未来の自分」**

- 出典: <https://www.swyx.io/learn-in-public>（swyx・2018-06-19・2026-08-17 確認）
- 事実（原文の表現）:

  > **`You already know that you will never be done learning.`**
  > **`But most people "learn in private", and lurk.`**

  > **`by far the biggest beneficiary of you trying to help past you is future you.`**

  > **`I keep an almost-daily dev blog written for no one else but me.`**

- 学び（**2 つ。うち 1 つは条件つき**）:

  **(1) 事例 70 と正面から噛み合う。**Nielsen は
  「90% は lurker で、それは無くせない」と書き、swyx は
  **`most people "learn in private", and lurk`** と同じ現象を名指したうえで、
  **「読者のためではなく未来の自分のために書く」**という別の動機を置いている。

  **CreatorYard にとってこれは重い。**この場所は**定着の常套手段を
  ほぼ全部禁じている** —— **順位表なし・称号なし・公開の閲覧カウンタなし・
  個人単位の行動計測なし**（CLAUDE.md の標準制約）。
  **他人の反応を返せない場所で、戻る理由をどこに置くか**という問いに、
  **「未来の自分」という答えが 1 つある。**

  **(2) ただし条件がある。**「未来の自分の役に立つ」と言えるのは、
  **書いたものを本人が読み返せるとき**だけである。
  **①はここを確かめた** —— `/account/` と `/creators/<handle>/` の
  **2 か所とも、本人の記録が並ぶ**（本文を読んで確認）。**条件は満たしている。**

  **①は「だから人が戻る」とは書かない。**戻るかどうかは**測っていない**し、
  **個人単位の行動計測をしないので測らない。**
  **言えるのは「動機の置き場が 1 つある」までである。**

## 70. **Jakob Nielsen「参加の不平等（90-9-1）」—— 「どうすれば無くせるか」への答えが `You can't.` である**

- 出典: <https://www.nngroup.com/articles/participation-inequality/>
  （Jakob Nielsen・2006-10-08・2026-08-17 確認）
- 事実（原文の表現）:

  > **`90% of users are lurkers (i.e., read or observe, but don't contribute).`**
  > **`9% of users contribute from time to time, but other priorities dominate their time.`**
  > **`1% of users participate a lot and account for most contributions`**

  「どうすれば克服できるか」に対する答えが、この 1 行である。

  > **`You can't. The first step to dealing with participation inequality is to`**
  > **`recognize that it will always be with us.`**

  無くせないが**曲線の形は変えられる**として、投稿の敷居を下げる・参加を
  副産物にする・作るより直すほうを用意する、といった手が挙げられている。

- 学び（**3 つ。うち 1 つは「この数字を当てはめない」という学び**）:

  **(1) 撤退条件の算数が変わる。**SPEC §4 は **30 日で書き手 10 人**である。
  **もし「公開して待つ」なら、90-9-1 の比では 10 人の書き手に
  1,000 人規模の訪問が要る。**本番はいま **`noindex, nofollow`** で
  **公開 Story 1 本**である。**待つ道は、算数として閉じている。**

  **(2) だから事例 66（PG「取りに行く」）と同じ結論になる。**
  **手で 1 人ずつ招くしかない。**

  **(3) ただし 90-9-1 を招待の変換率に使ってはいけない。**
  この数字は**開かれた場の閲覧者の比**であって、
  **名指しで招いた人の比ではない。**PG が言うのはまさにその差である。
  **①は「何人招けば何人書くか」を推測しない。**
  **言えるのは「広く公開して待つ道は算数として閉じている」までである。**

  **(4) 曲線を変える手は、CreatorYard に既に入っている**
  （敷居を下げる = **下書き・インタビュー方式・テンプレート・音声入力**）。
  **無いものを足す話ではなく、既にあるものを招待文で言えるかの話**である。

## 69. **GOV.UK デザインシステム「確認ページ」—— 受付番号と連絡先は、同じ 1 つのリストに並んでいる**

- 出典: <https://design-system.service.gov.uk/patterns/confirmation-pages/>
  （GOV.UK Design System・2026-08-17 確認）
- 事実（原文の表現）: `How it works` の節に、確認ページが含むべきものが
  箇条書きで並ぶ。

  | 原文 |
  | --- |
  | **`a reference number, if there is one`** |
  | **`details of what happens next and when`** |
  | **`contact details for the service`** |
  | `links to information or services that users are likely to need next` |
  | `a link to your feedback page` |
  | `a way for users to save a record of the transaction, for example, as a PDF` |

- 学び（**3 つ。うち 1 つは「まだ答えられない」という学び**）:

  **(1) 受付番号と連絡先は、同じリストの隣同士である。**
  CreatorYard の `/report/` の確認画面は
  **`a reference number` を出しているが、`contact details for the service` が無い。**
  **片方だけ実装した状態である。**そして④ 11:10 が見つけたとおり、
  **画面は「お問い合わせの際はこの番号をお伝えください」と、
  無い側を指している。**

  **(2) 「いつ」も書かれていない。**
  原文は **`details of what happens next and when`** である。
  CreatorYard の画面は **what（運営が内容を確認し、必要な対応を判断します）**
  は書いているが、**when が無い。**

  **これは書けば済むものではない。**「3 日以内に見ます」と書けるかは
  **運営体制の約束**で、**個人運営でそれを約束できるかは社長の判断**である。
  **①は案を出さない。要判断として置くだけにする。**

  **(3) 逆に、CreatorYard が既に満たしているものもある。**
  `links to information or services that users are likely to need next` は、
  **全ページの脚に「この場所の決まり・データの扱い・問題を通報する」が
  出ている**ので満たしている（④が本番で確認済み）。

  **なお `a link to your feedback page` と `save a record ... as a PDF` は、
  行政サービスの前提であって、個人運営の Creator Story に
  そのまま当てはめない**（事例 68 の 5 番と同じ形 —— **規範は文脈ごと読む**）。

## 68. **Stanford Web Credibility Guidelines —— 10 個のうち 2 個が、いま止まっている仕事を名指ししている**

- 出典: <https://credibility.stanford.edu/guidelines>（Stanford Persuasive
  Technology Lab・2026-08-17 確認）
- 事実（原文の表現）:
  - **`These guidelines are based on three years of research that included over 4,500 people.`**
  - 10 個の見出しのうち、CreatorYard にいま効くもの:

    | # | 原文 |
    | --- | --- |
    | 2 | **`Show that there's a real organization behind your site.`** |
    | 4 | **`Show that honest and trustworthy people stand behind your site.`** |
    | 5 | **`Make it easy to contact you.`** |
    | 10 | **`Avoid errors of all types, no matter how small they seem.`** |

  - 5 番の本文はこうである ——
    **`A simple way to boost your site's credibility is by making your contact information clear: phone number, physical address, and email address.`**

- 学び（**2 つあり、片方は「従わない」という学び**）:

  **(1) 10 番が I-8 を名指ししている。**
  **`no matter how small they seem`** —— ⑤が本番で確かめた I-8
  （2 条件で絞り込んでも画面は 1 条件しか名乗らない）は**小さな誤り**である。
  **小さいから後回しでよい、とは言えない根拠**がここにある。
  **①はこれを「小さいから急がない」と書かない。**

  **(2) 5 番は、そのままでは従えない。**
  原文は **電話番号・物理住所・メールアドレス**の 3 つを挙げる。
  **CreatorYard は個人運営である。**物理住所と電話を出すことは
  **実在の個人情報を公開すること**で、CLAUDE.md の
  「**確かめられない数字・実在の個人情報を並べない**」に触れる。

  **I-7 の設計はメールアドレス 1 つだけで閉じている**（`CY_CONTACT_EMAIL`・
  未設定なら節ごと出さない）。**これは手抜きではなく、
  企業サイトを前提にした指針を個人運営にそのまま当てない、という判断である。**
  **住所・電話を出すかは要判断（社長）だが、①は勧めない。**

  **2 番・4 番についても同じ形の緊張がある。**「本当の組織がある」ことを
  示す普通のやり方（会社概要・代表者名）は、**個人運営では個人情報の開示**に
  なる。**姉妹サービス GAMEYARD との関係を明示していること**は、
  **個人情報を出さずに 2 番へ答えている**数少ない材料である
  （実際、全ページの脚に出ている）。

## 67. **NN/g「空の状態」の 3 つの指針 —— ただし定義は「まだ中身が存在しない」入れ物**

- 出典: <https://www.nngroup.com/articles/empty-state-interface-design/>
  （Kate Kaplan・2021 年公開・2026-08-17 確認）
  **公開日は取得口で食い違った**（本文表示 09-19 / 検索結果 09-23）ので、
  **①は日まで断定しない。**年だけ書く。
- 事実（原文の表現）:
  - 空の状態の定義は
    **`containers, screens, or panels for which content does not yet exist or otherwise cannot be displayed`**
  - 指針は 3 つ。見出しは
    **`Use Empty States to Communicate System Status`** ／
    **`Use Empty States to Provide Learning Cues`** ／
    **`Use Empty States to Provide Direct Pathways for Key Tasks`**
  - 本文は空の状態が **`quite common during onboarding and initial usage`** と述べる
  - **「中身が 1 つだけある状態」についての記述は、この記事には無い**
    （①が本文を当たって確認した。**無いことを確認したのであって、
    NN/g が扱っていないと断じるものではない** —— 見たのはこの 1 記事）
- 学び:
  **CreatorYard の `/stories/` は、この 3 つ目の指針を正しく実装している。**
  0 件のとき「最初の 1 本を書きませんか」と**鍵になる仕事への直行路**を出す。

  **問題は、指針そのものが 0 で止まっていることである。**
  定義が **`content does not yet exist`**（まだ存在しない）なので、
  **1 つ存在した瞬間、この指針の適用範囲から外れる。**
  そして④が 07:10 に本番で見たとおり、**外れた先に何も置かれていない。**

  **「標準に従ったのに穴が空く」形である。**標準は 0 を語り、
  多数件は普通の一覧として語られる。**その間の 1 件は、どちらでもない。**
  **招かれた人が来るのは、まさにその間である。**

## 66. **「ユーザーは待っていても来ない。取りに行く」— Paul Graham "Do Things That Don't Scale"**

**この 24 時間、ループは配備と監視ばかり直していた。**そのあいだ、
**撤退条件の分母は動いていない。**本番の実データはいま
**書き手 1 人・公開 Story 1 本**（④が本番で実測）。SPEC §4 の撤退条件は
**公開から 30 日で書き手 10 人・Story 30 本**である。**足りないのは
仕組みではなく人**という可能性を、外の言葉で確かめた。

- 出典: Paul Graham "Do Things That Don't Scale"（2013 年 7 月。
  https://paulgraham.com/ds.html 2026-08-17 確認）
- 事実（原文）:
  > **The most common unscalable thing founders have to do at the start is
  > to recruit users manually.**
  >
  > You can't wait for users to come to you. You have to go out and get them.
  - 具体例として、Stripe の「Collison installation」——
    > When anyone agreed to try Stripe they'd say "Right then, give me your
    > laptop" and set them up on the spot.
  - Airbnb は
    > going door to door in New York, recruiting new users and helping
    > existing ones improve their listings.
- 学び:
  1. **「作れば来る」を前提にしていない。**うちはトップページも RSS も
     タグも整えたが、**呼びに行っていない**。PG が言うのは
     **順序の話**で、仕組みを作る前でも後でも、**手で 1 人ずつ**は要る
  2. **1 人ずつでよい、というのが救い。**10 人は**手で届く数**である。
     Stripe は目の前で設定させ、Airbnb は玄関を叩いた。**うちの
     「招待」も同じ粒度**でよい
  3. **既にある Story 1 本は、資産である。**「初めての投稿」が本番に在り、
     RSS にも載っている。**空の場所に呼ぶのと、1 本ある場所に呼ぶのは違う**
  4. **ただしこれは①が決めることではない。**誰を招くか・何と書いて招くかは
     **社長の判断**（要判断リストの「招待文」）。①ができるのは
     **招かれた人が最初に見るものを整えておくこと**まで

## 65. **`Content-Length` は「あるかもしれない」もの。比べるための道具は仕様に用意されているが、保証されているのは別のほう — RFC 9110**

④ 03:10 が #21 に見つけた穴（`content-length` が返らない応答がある）に、
**規範的な裏付けがあるか**を確かめた。**あった。しかも予想より強かった。**

- 出典: RFC 9110 "HTTP Semantics"（IETF・2022 年 6 月。
  https://www.rfc-editor.org/rfc/rfc9110.txt 2026-08-17 確認）
- 事実（原文・§8.6 Content-Length）:
  - **HEAD への応答では任意**:
    > A server **MAY** send a Content-Length header field in a response to
    > a HEAD request
  - **一般の応答でも SHOULD どまり**:
    > in the absence of Transfer-Encoding, an origin server **SHOULD** send
    > a Content-Length header field when the content size is known prior to
    > sending the complete header section
  - **そもそも「比べる」用途は仕様にも書かれている**:
    > Content-Length indicates the selected representation's current
    > length, which can be used by recipients to estimate transfer time or
    > **to compare with previously stored representations**
  - **ただし転送時は「囲まれたデータの量」を指す**:
    > When transferring a representation as content, Content-Length refers
    > specifically to the amount of data enclosed
- 事実（原文・§8.8.3 ETag）:
  > An entity tag is an **opaque validator for differentiating between
  > multiple representations of the same resource**
- 学び:
  1. **「比べる」という考え自体は正しかった。**RFC が用途として名指ししている。
     **間違っていたのは「必ずある」と思ったこと**（`MAY` / `SHOULD`）
  2. **圧縮されると値が変わるのも仕様どおり。**転送時の
     `Content-Length` は**囲まれたデータの量**＝圧縮後の長さで、
     手元の元サイズとは一致しない。**④の見立ては規範的に裏づけられた**
  3. **「同じものか」を見る道具は ETag のほうである**（`opaque validator
     for differentiating between multiple representations`）。ただし
     **CDN が圧縮時に書き換えることがある**ので、**うちの経路で実際に
     どうなるかは実測しないと言えない**（未確認）
  4. **いちばんの学びは 3 状態にすること。**仕様が `MAY` と言っている以上、
     **「一致」「不一致」の 2 つでは足りない。「比べられない」が要る。**
     2 状態しか持たない検査は、**分からないことを悪いことにしてしまう**

## 64. **同じ URL のまま中身を差し替えると、中間のキャッシュには消しに行けない — MDN の「キャッシュバスティング」**

④ 21:10・23:10 と⑤ 23:30 が見つけた「本番の動画だけ古いまま配られていた」に、
一般的な名前と定石があるか確かめた。**あった。**

- 出典: MDN Web Docs "HTTP caching"
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
  （2026-08-17 確認）
- 事実（原文）:
  - **消しに行けない**:
    > There is no way to delete responses on an intermediate server that have
    > been stored with a long `max-age`.
  - **定石は URL を変えること**:
    > it is a common best practice to change the URL each time the content
    > changes, so that the URL unit can be cached for a longer period.
  - 示されている形は 4 通り —— **ファイル名に版**（`bundle.v123.js`）、
    **クエリに版**（`bundle.js?v=123`）、**ファイル名にハッシュ**、
    **クエリにハッシュ**
  - そのうえで、**版つきのものには長い寿命を与えてよい**:
    > `Cache-Control: public, max-age=31536000, immutable`
- 学び（CreatorYard に効くところ）:
  1. **うちは半分だけ正しくやっていた。**`/_next/static/` は
     **ファイル名にハッシュ**が付く（Next.js が自動でやる）ので、
     8/16 の刷新でも CSS は即座に入れ替わった。**素の名前で置いている
     `public/media/` だけが取り残された**
  2. **「purge すればいい」で終わらせない。**原文が言うのは
     「**中間サーバーに置かれたものは消しに行けない**」であって、
     Cloudflare の purge が効くのは**うちが管理している 1 層だけ**。
     利用者のブラウザや途中の proxy には届かない。**URL を変えるのが唯一、
     全部の層に効く**
  3. **待てば直る、で済ませたのは今回がたまたま。**実際 8/17 00 時台に
     CF のキャッシュが `EXPIRED` になり新しい動画に入れ替わった。**だが
     それは寿命が短かったからで、長い `max-age` を付けていたら数か月
     居座った。**「今回は直った」を「仕組みが正しい」と読み替えない

## 63. **待ち行列は「入る速さ×待つ時間」で決まる — Little の法則。うちの滞留はここで説明がつく**

⑤ 21:30 が「作る側ではなく受け取る側で詰まっている」と裁定した。**その形に
名前と式があるか**を確かめた。**あった。**

- 出典: https://en.wikipedia.org/wiki/Little%27s_law （2026-08-16 確認）
- 事実（原文）:

  > the long-term average number of customers (*L*) in a stationary system
  > is equal to the long-term average effective arrival rate (*λ*)
  > multiplied by the average time that a customer spends in the system (*W*)

  すなわち **L = λW**。そして注目すべきはこの一文:

  > The relationship is not influenced by the arrival process distribution,
  > the service distribution, the service order, or practically anything
  > else.

  さらに「systems within systems」に適用でき、**部分系ごとにも成り立つ**と
  書かれている。
- **うちに当てはめると**（`L` ＝開いている PR、`λ` ＝ループが PR を出す速さ、
  `W` ＝社長が押すまでの時間）:

  | 変数 | いま | ループが動かせるか |
  | --- | --- | --- |
  | `L` 開いている PR | **9 本** | 結果であって、直接は動かせない |
  | `λ` 出す速さ | **2 時間ごとの③＋社長の直接指示** | **動かせる（唯一）** |
  | `W` 押すまでの時間 | 社長の生活時間 | **動かせない。増やしてもらう筋合いも無い** |

  **`W` は握れない。だから `λ` を下げない限り `L` は増え続ける。**これは
  やる気や段取りの問題ではなく、**式がそう言っている**（「service order や
  ほぼ何にも影響されない」）。
- 学び:
  1. **①②③の産出速度は、成果ではなく入力**である。速く作るほど、
     社長の前の山が高くなる。**山が高いほど、押す気力が要る**
  2. **1 本ずつの大きさは問題ではなかった。**うちの PR は
     33〜235 行と小さい（④が実測）。**小さい PR を 9 本積んでも、
     押す回数は 9 回**。`L` は本数で効く
  3. ループの決まりには**背圧（作るのをやめる条件）が 1 つも無い**。
     ④は「変化が無い周はスキップ」を持つが、**それは変化が無いときの話**で、
     **溜まっているときに止まる決まりは無い**

## 62. **バックアップは「取れた」ではなく「戻せた」まで見る。そして失敗は黙って通る — GitLab 2017-01-31 のデータ消失**

今夜の公開前ゲートに「`deploy/backup.sh` を 1 回実行」がある。**その「1 回
実行」が検査として成立しているか**を、外部の事故で確かめた。

**（2026-08-16 20:10 に出典を差し替え。⑤ 19:30 の裁定 3。初出時は
「原本が 403 で読めない」として二次資料から引いたが、④が別の道具で
引き直すと読めた。いまは原文 2 本が一次出典で、二次資料は補助。)**

- 出典 1（速報・**「5 系統」の出どころ**）:
  https://about.gitlab.com/blog/gitlab-dot-com-database-incident/
  （GitLab、2017-02-01。2026-08-16 確認）
- 出典 2（事後報告・**「気づけなかった」の出どころ**）:
  https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/
  （GitLab、2017-02-10。2026-08-16 確認）
- 出典 3（補助・全体の要約と "no ownership"）: Availability Digest
  "GitLab Suffers Massive Backup Failure Due to a Fat Finger"
  （Sombers Associates, Inc. / W. H. Highleyman、2017 年 4 月号。
  https://www.availabilitydigest.com/public_articles/1204/gitlab.pdf ）
- **取得についての注記（それ自体が学び）**: 原文 2 本は、最初に使った
  取得口では **403**、別の口では **200**。しかも出典 1 は
  **redirect を追わないと 307 で止まる**。**「読めない」は、相手が拒んだ
  ことと道具が黙ったことを区別しない**（⑤ 19:30 の申し送り 1）
- 事実（**原文**）:
  - 2017-01-31、担当者が待機系のつもりで**本番のデータディレクトリを消し**、
    約 300 GB が失われた。復旧まで約 36 時間（出典 3）
  - 出典 1（速報）より:
    > Our backups to S3 apparently don't work either: the bucket is empty
    > So in other words, out of five backup/replication techniques deployed
    > none are working reliably or set up in the first place.
  - 出典 2（事後報告）より —— **これが本件のいちばん重い一文**:
    > This in turn resulted in `pg_dump` terminating with an error. While
    > notifications are enabled for any cronjobs that error, these
    > notifications are sent by email. For GitLab.com we use DMARC.
    > Unfortunately DMARC was not enabled for the cronjob emails, resulting
    > in them being rejected by the receiver. **This means we were never
    > aware of the backups failing, until it was too late.**
  - 出典 1 には**もう 1 つの「黙って」**も出てくる:
    > `pg_basebackup` will silently wait for a master to initiate the
    > replication process
  - > Why weren't the backup and restore processes tested on a regular
    > basis? Because there was no ownership.（出典 3）
- 学び（CreatorYard に効くところ）:
  1. **「戻せた」までは、うちは既に満たしている。** `deploy/backup.sh` は
     既定で `BACKUP_DRILL=1`、取った直後に一時ディレクトリへ展開して
     **Story の件数を照合**し、合わなければ `die` する。GO-LIVE.md も
     「復元訓練 OK のログを見る」と書いている。**今夜の「1 回実行」は、
     ただの実行ではなく復元試験**であり、ゲートとしては見た目より強い
  2. **満たしていないのは 2 つ目の教訓のほう。** GitLab を沈めた決め手は
     「取れていなかったこと」ではなく「**取れていないと誰も知らなかった
     こと**」だった。うちの `creatoryard-backup.timer` が止まる／毎晩
     `die` で落ちる、のどちらが起きても、**気づく仕組みがいまは無い**。
     `deploy/healthcheck.sh` が見ているのは API・web・ディスクの 3 つで、
     バックアップには一切触れていない
  3. **持ち主がいない検査は回らない**（"no ownership"）。うちは人が 1 人な
     ので、**人の記憶ではなく既に回っている仕組みに相乗りさせる**しかない

## 61. **検査は「正しく作ったか」だけでなく「確かめたいものを見ているか」を問う — Boehm の verification / validation**

⑤が今周見つけた事故（「push した」と報告したが、リモートには上がって
いなかった）に、外部の枠組みがあるか確かめた。**近いものがあった。**

- 出典: https://en.wikipedia.org/wiki/Verification_and_validation
  （2026-08-16 確認。Barry Boehm, 1981 の定式化として紹介）
- 事実（原文）:

  > validation can be expressed by the query **"Are you building the right
  > thing?"** and verification by **"Are you building it right?"**

- **CreatorYard で起きたこと**: 解消 commit を push したあと、確認として
  `git rev-parse HEAD` を出した。これは**ローカルが正しいか**（Are you
  building it right?）を見る検査で、主張したかったのは
  **「リモートがこうなった」**だった。**検査の種類が、主張の種類と
  ずれていた** —— verification は通っていたが、validation をしていない
- ⑤の申し送り（「push した」と書く前にリモートを引き直す）は、この
  ずれを埋める具体策。**主張が外の世界の状態なら、検査も外の世界を見る**
- 学び: ループの検査は 3 層に分かれる ——
  (1) **書いたものが正しいか**（lint・型・試験）
  (2) **穴を本当に守っているか**（④の変異検査・事例 54）
  (3) **報告した状態が現実か**（今回追加。リモート・本番・公開応答を引く）。
  gdp の PR #14 の追加段（適用後に**公開レスポンス**を確認）は、
  配備における (3) そのものだった —— **同じ規律が別の場所で 2 回出た**

## 60. **道具が規律を置き換えると監視が緩む — automation complacency（自動化への安心）**

⑤が今周裁いた③の違反（解禁対応表を見て重なり検査をしなかった）に、
名前と先行研究があるか①が確かめた。**あった。**

- 出典: https://en.wikipedia.org/wiki/Automation_bias
  （`Automation complacency` は同ページへ転送。**転送先の題名で引くのが正**。
  2026-08-15 確認）
- 事実（原文）:

  > **automation complacency**: "poorer detection of system malfunctions
  > under automation compared with under manual control"
  >
  > **automation bias**: "propensity for humans to favor suggestions from
  > automated decision-making systems and to ignore contradictory information"

  同ページは両者を「different aspects of the same kind of automation misuse」
  と位置づけ、complacency は**注意・監視の不足**、bias は**過信**と区別する。
- **CreatorYard で起きたこと**: ②が作った「解禁対応表」は良い道具だったが、
  ③は**表を見たことで確認を済ませた気になり**、全 open PR とのファイル
  重なりを引かなかった（#16 と #10 が衝突）。これは bias（過信）ではなく
  **complacency（監視の手抜き）の側** —— 表は間違っていない。**表が
  答えない問いを、③が誰にも問わなかった**
- 学び: **道具は「何を答えるか」と同じ強さで「何を答えないか」を書く。**
  ⑤が②へ出した申し送り（表に「着手前チェック」を 1 行足す）は、この事例の
  対策そのもの。ループの道具（解禁対応表・merge-tree 定例・変異検査）は
  どれも監視を**代替**するのではなく**足す**ためにある、と位置づけを固定する

## 59. **フォームの磨き込みは見た目でなく規範から — NN/g のフォーム設計 10 箇条と「工房の夜」刷新**

社長指示のデザイン刷新（PR #15・globals.css のみ・2026-08-15）を、
外部のユーザビリティ規範と突き合わせて記録する。

- 出典: https://www.nngroup.com/articles/web-form-design/
  （Nielsen Norman Group, *Website Forms Usability: Top 10 Recommendations*,
  Kathryn Whitenton。2026-08-15 確認）
- 事実（原文）:

  > Labels should be **close to the fields they describe** (immediately
  > above the field for mobile and shorter desktop forms, ...)

- **刷新でやったこと・やらなかったこと**:
  - ラベルは**欄の直上**の既存構造を維持（規範どおり。placeholder を
    ラベル代わりにしない — placeholder は薄い例示のみに落とした）
  - 見た目の変更は CSS だけで、**44px タップ領域・focus-visible・
    prefers-reduced-motion の約束は不変**（フォーカスリングは outline から
    琥珀の box-shadow リングへ置き換えたが、可視であることは維持）
  - 「AI っぽさ」の正体を推測でなく列挙して潰した: 単色平面の羅列／
    既定フォーム部品／のっぺり背景／**ダークテーマに浮くクリーム色の
    つまずきカード（実在した不整合）**
- 学び: **「カッコよく」は装飾の追加ではなく、(a) 不整合の解消と
  (b) 奥行き（層・光・影）の設計。**規範が決めている部分（ラベル位置・
  可視フォーカス）は動かさず、規範が決めていない部分（色・層・質感）で
  差を作る。なお本記事にフォーカス可視性の項は無い（そこは WCAG 2.4.7 の
  領分 — 未引用のため主張しない）

## 58. **PARTNER-OFFER の Behance 側も検証完了 — 記述どおり。ただし直接取得は 403 で、索引確認である旨を残す**

事例 57 の残り（Behance 側 2 リンク）を①が検証した。

- 出典: https://help.behance.net/hc/en-us/articles/25287666847643-FAQ-How-do-I-create-a-new-Freelance-Job ／
  https://help.behance.net/hc/en-us/articles/8832406918811-Guide-Hire-Me
  （2026-08-15 確認。**両ページとも直接取得は 403（bot 保護）**のため、
  検索索引で題名・URL の一致と要旨を確認した — 確認の強度は
  「原文引用」より一段弱い。ここを隠さない）
- 事実（索引の要旨）: Freelance Job は依頼者の照会に対しフリーランサーが
  「Create Proposal」で正式提案を返し、**Stripe / PayPal で決済**される。
  Hire Me はフリーランサーが受注可否と仕事種別を示す機能
- **検証結果**: OFFER の「依頼者と制作者を仕事・提案・支払いへつなぐ」は
  **記述どおり**。これで OFFER の競合根拠は GitHub Sponsors（事例 57）・
  Behance の両方が検証済みになった
- 学び: **取得できない出典は「確認の強度」を明記して使う**（初回サイクルの
  TIGSource 403 → 不採用の前例と違い、今回は索引が題名と要旨まで一致した
  ので採用。ただし原文引用はできない、と書き分ける）

## 57. **Partner 商品の競合根拠を①が検証 — GitHub Sponsors の引用は「概ね正・引用位置が 1 段浅い」**

PR #3 の枝に新文書 `docs/PARTNER-OFFER.md`（初回商品「制作過程→作品公開
スポットライト」・税込 11,000 円・**販売は社長承認後**）が追加された
（2026-08-15 00:33・gdp または Partner 系エージェントの作）。文書内の
競合根拠を①が独立検証した。

- 出典: https://docs.github.com/sponsors/getting-started-with-github-sponsors/about-github-sponsors
  （GitHub 公式。2026-08-15 確認）
- 事実（原文）:

  > You can select from a range of sponsorship tiers, whether for an
  > individual profile or multiple profiles in bulk, and choose between
  > one-time or monthly payment amounts ... and benefits, all determined
  > by the sponsored account

- **検証結果**: PARTNER-OFFER の「単発・月額支援。支援 Tier には README 上の
  名前・ロゴ、早期アクセス等を設定できる」のうち、**Tier・単発/月額・
  特典は提供側が決める**までは引用ページの原文どおり。**「README の
  名前・ロゴ」の細部は同ページには無く、リンク先の Tier 設定文書側の内容**
  （主張自体は真だが、引用位置が 1 段浅い）。Behance 側 2 リンクは未検証
  （次周に回す）。文書自身が「差分仮説である」「断定するものではない」と
  身の丈を明記している点は、ループの出典規律と同じ型で良い
- 学び: **競合比較の引用は「どのページに書いてあるか」まで合わせる。**
  主張が真でも引用位置がずれていると、後から検証する人が「書いてない」と
  誤判定する（①自身が一瞬そうなりかけた）

## 56. **配備は「再現可能な自動の列」にする — Google SRE 本のリリースエンジニアリング**

gdp の 10 個目の貢献（PR #14 `9671a8e`: apply-latest.sh に事前検査・
ビルド成功までは本番に触らない順序・CSP の失敗時切り戻しを追加）を
外部標準と突き合わせる。

- 出典: https://sre.google/sre-book/release-engineering/
  （Google SRE Book, Chapter 8 *Release Engineering*, Dinah McNutt。
  2026-08-14 確認）
- 事実（原文）:

  > Running reliable services requires reliable release processes.
  > Site Reliability Engineers (SREs) need to know that the binaries and
  > configurations they use are built in a **reproducible, automated way**
  > so that releases are repeatable and aren't "unique snowflakes."

- **CreatorYard で起きたこと**: ③の初版 apply-latest.sh は「動く列」では
  あったが、(a) 検査（root か・main か・作業樹が綺麗か）無しに始まり、
  (b) **ビルドが失敗しても、その前に nginx と静的ファイルを触ってしまう
  順序**で、(c) nginx reload 失敗時の CSP 切り戻しが無かった。gdp は
  「**全ビルド成功 → はじめて本番に触る → 失敗したら戻す**」に直した。
  今夜の本番設置で人間（社長＋Claude）が手作業でやって踏んだ穴の列を、
  スクリプトが同じ穴を踏まない形に焼き込んだもの
- 学び: **配備スクリプトの品質＝「成功時に正しい」ではなく「失敗時に
  壊さない」。**手順の自動化は、手順の順序と失敗経路まで自動化して
  はじめて「unique snowflake」でなくなる
- ④への申し送り: gdp 版は nginx 設定を `/etc/nginx/sites-available/creatoryard`
  の**固定パスに前提化**した（無ければ中止）。本番の実ファイル名が
  これと違う場合は**安全に停止する**（壊れはしない）。初回実行で
  「がありません」と出たら、実ファイル名を聞き取って直すこと

## 55. **5 秒を超える自動再生には「止める手段」が要る — WCAG 2.2 SC 2.2.2（Pause, Stop, Hide）**

PR #13（ホームの 27 秒背景動画）を出した直後に、①が自分たちの実装を
外部基準に当てて見つけた改善点。

- 出典: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
  （W3C, Understanding SC 2.2.2。2026-08-14 確認）
- 事実（原文）:

  > For any moving, blinking or scrolling information that (1) **starts
  > automatically**, (2) **lasts more than five seconds**, and (3) is
  > **presented in parallel with other content**, there is **a mechanism
  > for the user to pause, stop, or hide it** unless the movement,
  > blinking, or scrolling is part of an activity where it is essential

- **CreatorYard への当てはめ**: PR #13 の背景動画は 3 条件がすべて成立する
  （自動開始・27 秒・見出しや CTA と並行表示）。実装済みの
  `prefers-reduced-motion` フォールバックは **OS で設定した人にしか効かない**。
  設定していない人が動きを止める手段が、いまは無い
- 学び: **「装飾だから読み上げから外す」（aria-hidden）と「動きを止められる」
  は別の要求。**前者は済んでいるが後者が残っている。動きが苦手な読み手
  （前庭障害・注意の散りやすさ）は書き手候補にも普通にいる —— 書き手の
  体験の観点でも、止めるボタン 1 つは価値がある

## 54. **暦日バグは「試験を持つ組織」でも本番まで届く — Windows Azure の閏日全面障害（2012）**

⑤の指示（gdp の 6 例目「試験が実装と誤前提を共有すると検出できない」の
外部事例を出典つきで）に応える。

- 出典: https://azure.microsoft.com/en-us/blog/summary-of-windows-azure-service-disruption-on-feb-29th-2012/
  （Microsoft Azure Team による公式 RCA、2012-03-09。2026-08-14 確認）
- 事実（原文）:

  > The leap day bug is that the GA calculated the valid-to date by simply
  > taking the current date and adding one to its year. That meant that any
  > GA that tried to create a transfer certificate on leap day set a
  > valid-to date of **February 29, 2013, an invalid date** that caused the
  > certificate creation to fail.

  証明書の有効期限を「年に 1 を足す」だけで作っていたため、閏日に動いた
  全 VM が**存在しない暦日**を作って落ち、連鎖して全面障害になった。
  そして Microsoft 自身が再発防止をこう書いている:

  > The root cause of the initial outage was a software bug due to the
  > incorrect manipulation of date/time values. **We are taking steps that
  > improve our testing to detect time-related bugs.**

- **CreatorYard で起きたこと（同じ構造が 2 つ）**: PR #11 の初版は
  (1) 存在しない暦日 `2026-02-30` を受理していた（Azure の
  「February 29, 2013」と同じ「作ってはいけない暦日」の見逃し）、
  (2) 試験自身が実装と同じ UTC 前提で書かれていて緑のままだった
  （Azure も「試験の改善」を再発防止に挙げた＝**試験はあったのに
  時刻の族のバグを検出できていなかった**）。gdp が両方を修正（⑤追認済み）
- 学び: **日付・時刻のバグは「試験がある」ことでは防げない。試験が
  実装と別の前提（別の時刻帯・閏日・存在しない暦日）を明示的に持つ
  ときだけ検出できる。**世界最大級の試験体制でも閏日は本番まで届いた。
  ④の道具箱（JST 00:00〜08:59 相当の実行を必ず問う）と②の設計様式
  （時刻帯と「暦日か時刻差か」を設計に書く）は、この事例の縮小版の実装

## 53. **「行動の結果の警告」は、行動の前に置く部品として様式化されている（GOV.UK）**

gdp の 5 例目（PR #10 の注意書きをボタンの**前**へ移した）を、
公共の設計体系と突き合わせて記録する。

- 出典: https://design-system.service.gov.uk/components/warning-text/
  （GOV.UK Design System, *Warning text*。2026-08-14 確認）
- 事実（原文）:

  > Use the warning text component when you need to warn users about
  > something important, such as **legal consequences of an action, or lack
  > of action, that they might take.**

  英国政府の設計体系は「**これからする行動の重い結果**を伝える文」を
  独立した部品として持ち、**行動（ボタン）の前に置く**例で示している。
- **CreatorYard で起きたこと**: I-6（「公開すると RSS に載り、配信済みは
  取り消せない」）を、③は**元の注意書きの位置＝ボタンの後ろ**に置いた。
  文言 3 要素・リンク・試験の縛り方など**設計の字面はすべて守っていた**が、
  スマホでは**公開ボタンが注意書きより先に画面に入る** —— 「押す前に伝える」
  という設計の題が、位置で崩れていた。gdp が `form__actions` の直前へ移し、
  **順序を縛る試験**（文言は縛らない）を足した。
- 学び 1: **「何を書くか」と「どこに置くか」は別の設計項目。**
  意図が位置に依存する文（行動の前に読ませたい文）は、**位置も設計に書く**
  （②の設計には位置の指定が無く、③は字面どおりに作って通ってしまった）
- 学び 2: 押す前に読ませる文は、**押す指の途中に置く**のが様式。
  GOV.UK の部品がボタン群の直前に置かれるのと同じ形に、gdp の修正で揃った

## 52. **「マージしてみないと分からない」は道具で先に潰せる — `git merge-tree` は作業ツリーを触らずに衝突を判定する**

gdp が PR #9 の検証で使った技法。④の「節が違うから恐らく大丈夫」（推論）を、
gdp は**機械の判定**に置き換えた。①が公式文書で裏を取った。

- 出典: https://git-scm.com/docs/git-merge-tree （2026-08-14 確認）
- 事実（原文）:

  > Performs a merge, but **does not make any new commits and does not read
  > from or write to either the working tree or index.**

  > When the merge has conflicts, **the exit status is 1.**

- **CreatorYard で起きたこと**: PR #6 と #9 が同じ `deploy/GO-LIVE.md` を触る。
  ④は「触る節が違うので恐らく自動マージできる」と**推論**で書いた（09:10）。
  gdp は `git merge-tree --write-tree` で**機械的競合なしを判定**した（10:35）。
  どちらも「衝突しない」という同じ結論だが、**片方は恐らく・片方は判定**。
- 学び 1: **「恐らく」で済ませていた場所に、exit code で答えが出る道具があった。**
  マージ順の案内（#6 → #9）のような申し送りは、今後この 1 コマンドを
  添えてから出せる。**④の検査道具箱に足す**（`git merge-tree --write-tree
  <base> <A> <B>` → exit 0 なら衝突なし）
- 学び 2: 事例 50 と同じ形 — **推論で書いた文は、一次資料（今回は機械の判定）で
  置き換えられるなら置き換える。**gdp が繰り返し示している型で、
  これで 4 例目（sources / canonical / ページ送り / merge-tree）

## 51. **「独立した読み手」は業界標準になっている（IV&V）— gdp の 3 連続ヒットは、その教科書どおりの再現**

⑤ 09:30 の指示。**gdp が 24 時間で本物の欠陥を 3 連続で見つけた**構造を、
外部の枠組みと突き合わせて記録する。

- 出典 1: https://www.nasa.gov/ivv-services/ （NASA IV&V Office。2026-08-14 確認）
  - 「responsible for providing a systems engineering function that is
    focused on **partnering with missions to improve reliability and reduce
    the risk of safety and mission-critical software**」
  - NASA は**独立検証専門の組織**を常設している（プロジェクトの中に置かない）
- 出典 2: https://en.wikipedia.org/wiki/Software_verification_and_validation
  （2026-08-14 確認）
  - 「The ISVV team independency is performed at three different levels:
    **financial, managerial and technical**.」
  - 「IV&V is mentioned in DO-178B, ISO/IEC 12207 and **formalized in
    IEEE 1012**.」— 独立した検証は思いつきではなく**規格化された実務**

- **CreatorYard で起きたこと（第一次資料は PR #7・#8 のコメント）**:
  gdp が 24 時間以内に本物の欠陥を 3 連続で発見した。

  | # | 発見 | 4 者（②③④⑤）が見逃した理由 |
  | --- | --- | --- |
  | 1 | `sources` が保存で消える | 入口の検査ばかり叩き、**保存の往復**を見なかった |
  | 2 | canonical の意味論（page・AND・正規化） | **一次文書（Google）に当たらず**、推論の内部整合だけ見た |
  | 3 | ページ送りで `topic` が落ちる | **PR の差分だけを見て、隣の既存コード**を読まなかった |

  **3 件に共通するのは、gdp が「差分」ではなく「実物」を独立に読んだこと。**
  ①〜⑤は同じ会話の中で順番に検査するので、**前の役割の前提を引き継いでしまう**
  （②の「ページ送りは同じ一覧の続き」という前提を、③④⑤の誰も疑わなかった）。
  gdp は別の場所で main と PR head を自分で clone して読むので、**前提を
  引き継がない。これが IEEE 1012 の言う technical independence の実物**。
- 学び: **検査の回数を増やしても、独立性は増えない。**ループ内の 4 回の検査は
  「同じ前提での 4 回」だった。**gdp という独立した読み手が 1 人いることが、
  ループ内の検査 4 回ぶんより多くの欠陥を見つけている。**この分業
  （ループ＝作る速さ、gdp ＝独立の検証）は**設計として維持する価値がある**。

## 50. **Google は「ページ送りの 2 ページ目以降を 1 ページ目へ canonical で寄せるな」と明文で禁じている**

⑤ 07:30 の指示。gdp が PR #8 の書き換え根拠として出した出典を、①が原文で確かめた。

- 出典: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
  （Google Search Central, *Pagination and incremental page loading*。2026-08-14 確認）
- 事実（原文）:

  > **Give each page a unique URL.** For example, include a `?page=n` query
  > parameter, as URLs in a paginated sequence are treated as separate pages
  > by Google.

  > **Don't use the first page of a paginated sequence as the canonical
  > page.** Instead, give each page its own canonical URL.

- **CreatorYard で起きたこと**: ②が「ページ送りは同じ一覧の続きで、別の内容では
  ない」という前提で「`page` は落として 1 ページ目へ寄せる」と設計し（T-1a）、
  ③が忠実に実装し、**④も⑤も通した**。gdp が PR #8 への push でこれを正し、
  上の文書を根拠に挙げた。**Google が「するな」と明文で書いていることを、
  4 者が誰も文書に当たらずに設計していた。**
- 学び 1: **「同じ一覧の続き」は読み手の感覚であって、クローラの扱いではない。**
  2 ページ目には 2 ページ目の Story が並ぶ＝**別の内容**。canonical で
  1 ページ目に寄せると、**2 ページ目以降の Story は検索から実質見えなくなる**
  （集客に直接効く。タグ SEO は ACQUISITION A1 の柱）。
- 学び 2（構造）: **4 者が通したものを 1 人が正せたのは、その 1 人だけが
  一次文書に当たったから。**②は推論で設計し、③④⑤は設計の内部整合だけを
  見た。**「もっともらしい推論」は、順番に検査する 4 人を全員すり抜ける。**
  一次文書との突き合わせは、検査の数では代替できない。

## 49. **保有個人データについて「苦情の申出先」を本人が知り得る状態に置くことが法で求められている**（法第 32 条）

①が `origin/main` を読んで**書き手が運営に連絡する道が 1 つも無い**ことに
気づいた（→ 提案 2026-08-14 06:10）。**法の側に何と書いてあるかを確かめた。**

- 出典: https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/
  （個人情報保護委員会「個人情報の保護に関する法律についてのガイドライン
  （通則編）」。2026-08-14 確認）
- 事実:
  - **法第 32 条**により、個人情報取扱事業者は保有個人データに関する事項を
    **本人が知り得る状態に置かなければならない**。対象には
    **開示・訂正・削除・利用停止の請求手続**と、ガイドライン 3-8-1 の
    **「苦情の申出先」**が含まれる
  - ガイドラインの定義:

    > 「本人が知り得る状態」とは、本人が**知ろうとすれば時間的・手段的に
    > 簡単に知ることができる状態**をいい、事業の性質及び個人情報の
    > 取扱状況に応じ**合理的かつ適切な方法**によらなければなりません。

  - 実装例として**自社ホームページのわかりやすい場所への掲載**が挙げられている
- **CreatorYard の現物**（`origin/main` `38a76eb`）:
  - 画面は `app/` 配下に **17 個**。**`/contact` も `/help` も無い**
  - 「問い合わせ」「連絡」の語が在るのは
    `app/report/`（**他人を通報する**）・`app/admin/reports/`（**運営側**）・
    `app/signup/` の 3 か所だけ
  - **`/data-policy` と `/guidelines` に窓口の記載が無い**（`git grep` で 0 件）
- 学び: **「退会できる」と「連絡できる」は別のこと。**CreatorYard は退会で
  記録を全部消せる（`removeByAuthor`）が、**それは本人が画面を操作できる
  ときの話**。ログインできなくなった人・自分の記録の扱いを聞きたい人には道が無い。
- **①はこれが法的に必須かを判断していない。**上は条文とガイドラインの
  引用であって、**適用の可否・必要な記載事項は社長と専門家が決めること**。
  ①が確かめたのは「**法にはこう書いてある**」と「**いま画面に無い**」の 2 つだけ。

## 48. **フィードに一度出したものは、取り消す方法が仕様に無い** — Atom は 2012 年に専用の要素を足して、ようやくそれを言えるようにした

⑤ 03:30 が「U-1 は**一度配られたら取り消せない**」を理由に順番を入れ替えた。
**その「取り消せない」に、規格の裏を取った。**

- 出典: https://www.rfc-editor.org/rfc/rfc6721.html
  （*The Atom "deleted-entry" Element*, **RFC 6721, September 2012**。2026-08-14 確認）
- 事実（原文）:

  > In the base Atom format, when an entry is removed from a feed but a
  > consumer has already received and processed that entry, perhaps adding
  > it to a local cache or display, **there is no mechanism for determining
  > that the entry has been removed.**

  **「消えたことを知る手段が無い」ので、専用の要素を後から足した**のが RFC 6721。
- 学び 1: **「フィードから消す」と「読者の手元から消える」は別のこと。**
  CreatorYard の RSS は **RSS 2.0**（`server/lib/feed.mjs`）で、
  **RFC 6721 は Atom の拡張**なので**そのままは使えない**。
  つまり**こちらには取り消しの口が最初から無い。**
- 学び 2: **だから「出す前」しか手が無い。**サイト上の取り消し（公開 → 下書きに
  戻す）は効く（`latestPublic()` が `status === 'public'` で絞る）が、
  **既に配られたものには効かない。**⑤が U-1 を先に置いたのは、
  **この一方通行の性質が理由**として正しい。
- 学び 3: **書き手はこれを知らされていない**（→ 提案 2026-08-14 04:10）。

## 47. **`alt=""` は「読み上げなくてよい」という明示の指定。情報を持つ画像に付けると内容が丸ごと消える**

gdp が 2026-08-14 に指摘した件（Issue #1
[#issuecomment-5283715483](https://github.com/tukemen-rgb/creater-yard/issues/1#issuecomment-5283715483)）。
**①が `origin/main` を読んで裏を取った。**

- 出典: https://www.w3.org/WAI/tutorials/images/decision-tree/
  （*An `alt` Decision Tree*, W3C Web Accessibility Initiative。2026-08-14 確認）
- 事実（原文）:
  - 情報を持つ画像 —— 「Use a **brief description of the image** in a way that
    conveys that meaning in the `alt` attribute.」
  - 装飾の画像 —— 「Use an **empty `alt` attribute**」（purely decorative /
    not intended for users のとき）
- **CreatorYard の現物**（`origin/main` `38a76eb`）:
  - `components/story-article.tsx:39` … **`alt=""`**
  - `app/write/page.common.tsx:436` … **`alt=""`**
  - `lib/api.ts:22-27` の `StoryImage` は **`id` / `ext` / `width` / `height` の
    4 つだけ。説明を入れる場所がそもそも無い**
- 学び: **`alt=""` は「空欄」ではなく「装飾です」という宣言。**
  Story の画像は多くの場合**制作の途中経過やつまずいている画面**＝
  本文の一部なので、宣言の中身が事実と食い違っている。
  **書き手が「見てほしい」と思って貼ったものが、読み上げ利用者には
  存在しないことになる。**

## 46. **「`npm audit` 0 件」は、測った瞬間の値でしかない**

**08-13 に「high 0 件・critical 0 件・合計 0 件」と記録した同じツリーが、
08-14 には high 3 件を出した。**コードは 1 行も変わっていない。

- 出典: https://github.com/advisories/GHSA-2v37-7h3g-55p8
  （*nanoid: custom generators can loop indefinitely when size is zero*。
  **CVE-2026-67213 / High・CVSS 8.2 / 公開 2026-07-29**。2026-08-14 確認）
- 事実（原文）:

  > nanoid (Nano ID) before 5.1.6 contains an **infinite loop** in the
  > `customAlphabet` and `customRandom` functions. When these functions are
  > configured with a **size of 0**, the internal generation loop never
  > satisfies its exit condition and **spins indefinitely, hanging the
  > calling thread**.

  直った版は **3.3.18** と **5.1.6**。
- **CreatorYard の現物**: `origin/main` の `package-lock.json:4070` に
  **`nanoid` 3.3.17**。経路は **next → postcss → nanoid**（間接依存）。
  gdp が **PR #5** で `overrides.nanoid=3.3.18` を出した
  （`package.json` と lock の **2 ファイル・+5/-4** だけ）。
- 学び 1: **「監査は緑」は日付とセットでなければ意味を持たない。**
  PR #4 の本文には「`npm audit`: high 0件（2026-08-13、最終lock）」と
  **日付つきで**書いてあった。**その書き方は正しかった** —— 日付が無ければ、
  いま読んだ人は「いまも 0 件」と読む。
- 学び 2: **助言の公開日（07-29）は、0 件と記録した日（08-13）より前。**
  なぜ 08-13 の測定で出なかったのかは**確かめられていない**
  （`npm audit` が見る登録簿と GitHub Advisory の同期には差がありうるが、
  **確かめていないので断定しない**）。**確かなのは「同じツリーで結果が変わった」
  ことだけ。**公開前ゲートの監査は、**公開の直前にもう一度測る**必要がある。
- 学び 3: **これは依存を増やす話ではない。**`nanoid` は既に入っている
  間接依存で、`overrides` は**版を留める**だけ。CLAUDE.md の
  「実行時は next / react / react-dom の 3 つだけ」は破っていない。

## 45. **JSON Merge Patch（RFC 7396）は「無い」と「null」を別物として定義している**

gdp が 08-14 に見つけた不具合（下記 44）の直し方が、**14 年前から
標準として存在する意味論とまったく同じ**だった。偶然ではなく、
これは**繰り返し踏まれてきた穴**という証拠なので事例として残す。

- 出典: https://www.rfc-editor.org/rfc/rfc7396.html
  （*JSON Merge Patch*, RFC 7396, October 2014。2026-08-14 確認）
- 事実（原文）:

  > If the provided merge patch contains members that do not appear
  > within the target, those members are added. If the target does contain
  > the member, the value is replaced. **Null values in the merge patch are
  > given special meaning to indicate the removal of existing values in
  > the target.**

  つまり **「項目が無い＝触らない」「null が入っている＝消す」**を
  はっきり別の意味に分けている。
- 学び: gdp の直し（`input.sources === undefined` なら現状維持、
  明示的な `[]` / `null` のときだけ削除）は、**RFC 7396 と同じ形**に
  独立にたどり着いている。**この形が正しいことは規格で裏が取れている**ので、
  以後 CreatorYard の更新処理はこの意味論を基準にしてよい。
  ただし RFC 7396 は「配列は丸ごと置換」と定めており（部分更新できない）、
  `sources` を 1 件だけ消す操作は**別に考える**必要がある。

## 44. **PUT は「全部入れ替え」。名前が PUT なのに部分更新をすると項目が消える**

**この事例は他社ではなく CreatorYard 自身で起きた**（08-14、gdp が発見）。
規格の側に何と書いてあるかを出典つきで残す。

- 出典: https://www.rfc-editor.org/rfc/rfc5789.html
  （*PATCH Method for HTTP*, RFC 5789, March 2010。2026-08-14 確認）
- 事実（原文）:

  > The PUT method is already defined to overwrite a resource with a
  > complete new body, and cannot be reused to do partial changes.

  > In a PUT request, the enclosed entity is considered to be a modified
  > version of the resource stored on the origin server, and the client is
  > requesting that the **stored version be replaced**. With PATCH, however,
  > the enclosed entity contains a **set of instructions** describing how a
  > resource currently residing on the origin server should be modified.

- **CreatorYard で実際に起きたこと**: `PUT /api/stories/<id>` は名前どおり
  「全部入れ替え」で実装されている（`update()` の `...fields`）。ところが
  **画面の編集フォームは `sources` を持っていない**。自動記録から作った
  Story を書き手が本文だけ直して保存すると、フォームが送らなかった
  `sources` が `undefined` → 空で上書きされ、**根拠リンクが黙って消えた**。
  発見は gdp（PR #4 コメント 2026-08-14）、直しは `388afe9` / `654dd70`。
- 学び: **「PUT だから全部送ってくるはず」は、画面がその項目を持っていない
  瞬間に崩れる。**送る側（画面）と受ける側（API）の項目一覧がずれた時点で、
  ずれた項目は**消える側に倒れる**。`image` には最初から現状維持の
  ガードがあったのに `sources` には無かった。**ガードが項目ごとの
  手当てになっていると、3 つ目で必ず忘れる**（→ 提案 08-14 00:10）。

## 43. 再ビルドの回し方 — **cron は重なりを防がない。systemd timer は防ぐ**

⑤ 07:37 の指示 2（段階 B の下ごしらえ）。

- 出典: https://man7.org/linux/man-pages/man5/systemd.timer.5.html
  （2026-08-10 確認）
- 出典: `flock(1)` の挙動は**この機械で実際に動かして確かめた**
  （下記。読んだだけではない）
- 事実（systemd timer の公式 man）:
  - **重なり**: 「**in case the unit to activate is already active at the
    time the timer elapses it is not restarted, but simply left
    running.**」＝ **前のビルドが走っていれば、次は起動しない**
  - `Persistent=`: 「the time when the service unit was last triggered is
    stored on disk. When the timer is activated, the service unit is
    triggered immediately **if it would have been triggered at least once
    during the time when the timer was inactive**.」
    ＝ **止まっていた間の取りこぼしを 1 回だけ埋める**
  - `RandomizedDelaySec=`: 「Delay the timer by a **randomly selected**,
    evenly distributed amount of time between 0 and the specified
    time value.」＝ 同時発火を散らす
  - `OnUnitInactiveSec=`: 「Defines a timer relative to **when the unit
    the timer unit is activating was last deactivated**」
    ＝ **前回のビルドが終わってから** N 秒。`OnCalendar=`（実時刻）と
    違い、**ビルドにかかる時間を織り込める**
- 事実（`flock` を実際に動かした結果）:

  ```
  1 本目: 取れた
  2 本目: 弾かれた（重なりを防いだ）
  ```

  `flock -n`（`--nonblock` = fail rather than wait）で 2 本目が弾かれる。
  **cron 自体には重なりを防ぐ仕組みが無いので、これを噛ませる必要がある**
- 事実（この機械）: `flock` と `systemctl` は在る。**`crontab` は無い**
  （確認済み。VPS に何が在るかは別の話）
- 学び:
  - **ビルドが 10 分かかるのに 5 分ごとに回すと、cron なら重なる。**
    重なると `out/` を 2 つの過程が同時に書く
  - **`OnUnitInactiveSec=` は「窓の長さ」を素直に表せる。**
    提案 28 で「再ビルドの間隔は soft 404 の窓で決める」と決めたが、
    `OnCalendar=` だとビルドが長引いたとき窓が読めなくなる
  - `Persistent=` は**サーバーを止めていた間の取りこぼしを埋める**。
    無人運用では効く
  - **ただし systemd が使えるかは VPS 次第。**使えないなら
    **cron ＋ `flock -n` が最低条件**

## 42. 証明書の取り方は 3 通りある — **Origin CA は「オレンジ雲を外せなくなる」**

⑤ 07:37 の指示 1（段階 B の最初の関門）。

- 出典: https://letsencrypt.org/docs/challenge-types/ （2026-08-10 確認）
- 出典: https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/
  （2026-08-10 確認）
- 事実（Let's Encrypt の HTTP-01）:
  - 「The HTTP-01 challenge **can only be done on port 80**.」
  - リダイレクトは**10 段まで追う**（HTTP / HTTPS の 80・443 へ）。
    つまり **HTTPS への強制リダイレクトがあっても成立する**
  - `http://<ドメイン>/.well-known/acme-challenge/<TOKEN>` に
    ファイルを置く方式
  - ワイルドカード証明書は**取れない**
  - **確かめられなかったこと**: **CDN・リバースプロキシの裏で通るか**。
    Let's Encrypt の文書は**そこに触れていない**。
    **「Cloudflare のオレンジ雲を通る」とは書かれていない**ので、
    通ると書かない
- 事実（Let's Encrypt の DNS-01）:
  - `_acme-challenge.<ドメイン>` に TXT レコードを作る
  - 「it **only makes sense** to use DNS-01 challenges **if your DNS
    provider has an API** you can use to automate updates.」
    → **Cloudflare は API を持つので条件に合う**
  - ワイルドカードが**取れる**
  - **警告**: 「**Keeping API credentials on your web server is risky**」。
    権限を絞った資格情報を使うか、別のサーバーで検証する
- 事実（Cloudflare Origin CA）:
  - 目的は「Cloudflare と origin の間の暗号化」
  - 「**only encrypt traffic between Cloudflare and your origin server,
    not traffic from client browsers to your origin**」
  - 「If your origin only receives traffic from **proxied records**」の
    ための仕組みで、**Cloudflare を止めたりプロキシを切ると
    訪問者に「信頼できない証明書」の警告が出る**
  - **有効期限の通知は来ない**（Cloudflare が送らないと明記）
- 学び:
  - **Origin CA は縛りを増やす。**CreatorYard は A 案でオレンジ雲を
    選んだが、**将来 B 案（別サーバー＋灰色雲）へ移る余地**は残して
    おきたい。Origin CA を入れると、**雲を外した瞬間にサイトが警告を出す**
  - **期限通知が来ない**のも運用上の落とし穴。Let's Encrypt は
    期限前に知らせが来るが、Origin CA は自分で覚えておくしかない
  - **HTTP-01 が通るかは、やってみるまで分からない。**
    「たぶん通る」で手順を書かない。**まず試し、駄目なら DNS-01**、の
    順で段階 B の手順に書く
  - DNS-01 を選ぶなら、**Cloudflare の API トークンは DNS 編集だけに
    絞る**（Let's Encrypt 自身の警告）。ドメインを移せる権限を
    サーバーに置かない

## 41. Next.js の metadata は **shallow merge**。子で `openGraph` を書くと親の中身が丸ごと消える

- 出典: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
  （2026-08-10 確認・ページ記載の版は 16.3.0。**このリポジトリは 15.5.22**）
- 出典: このリポジトリの `out/` を実際に比べた結果（**実物が先、文書が裏付け**）
- 事実（公式の文言）:
  - 「Metadata objects exported from multiple segments in the same route
    are **shallowly** merged together… Duplicate keys are **replaced**
    based on their ordering.」
  - 「metadata with **nested fields such as `openGraph` and `robots`**
    that are defined in an earlier segment are **overwritten** by the
    last segment to define them.」
  - 公式の例でも、layout の `openGraph.description` が page 側で
    `openGraph` を書いた時点で消える（「**Note the absence of
    `openGraph.description`**」と明記されている）
  - **公式の対処 2 つ**:
    1. 共有したい入れ子を「**pull them out into a separate variable**」
       して各ページで spread する
    2. `generateMetadata` の第 2 引数 `parent` で
       「**access and extend (rather than replace) parent metadata**」
- 事実（実物・2026-08-10 に `out/` を比較）:
  段階 A-3 で各ページに `alternates: { canonical }` を書いた結果、
  **焼いたページから 2 つ消えていた**:

  | 消えたもの | どこから来ていたか |
  | --- | --- |
  | `<link rel="alternate" type="application/rss+xml">` | layout の `alternates.types` |
  | `<meta property="og:locale" content="ja_JP">` | layout の `openGraph.locale` |

  シェル（`out/s/index.html` など）と固定ページには**残っている**。
  **焼いたページだけが失っている**。
- 学び:
  - **「足したものを見る」検査では捕まらない。**③は canonical を足した
    ことを、④は canonical と `og:url` の一致を確かめたが、
    **どちらも消えたものを見ていない**（⑤ 05:38 が見つけた）
  - **入れ子の鍵を 1 つでも書いたら、その鍵の中身は全部自分で書く**
    ことになる。`openGraph` に `title` だけ書くつもりでも、
    親の `locale` や `images` は消える
  - 対処は公式が示している。**共有分を変数にまとめて spread する**のが、
    このリポジトリの形（`lib/og.ts` に寄せる）に合う
  - **版が違う点に注意**: 読んだ文書は 16.3.0 版。**ただし 15.5.22 の
    実物で同じ挙動を確認している**ので、この事例は実測が根拠

## 40. **200 を返して「見つかりません」と書くと soft 404 になる** — A-5 のフォールバックがそれに当たる

- 出典: https://developers.google.com/search/docs/crawling-indexing/http-network-errors
  （2026-08-10 確認）
- 出典: https://developers.google.com/search/docs/advanced/crawling/soft-404-errors
  （2026-08-10 確認）
- 事実:
  - `200 (success)` を返したとき「the indexing systems **may** index the
    content, but that's **not guaranteed**」
  - 「if the content suggests an error for Google Search, **an empty page
    or an error message**, Search Console will show a **`soft 404`**
    error.」
  - **確かめられなかったこと**: Google の推奨する直し方。2 つのページとも
    定義と結果までで、対処は外部の記事へのリンクになっていた。
    **推測で埋めない**（リンク先は本文が取れなかった）
- 事実（このリポジトリ）: A-5 で入れる
  `try_files $uri $uri/index.html /s/index.html` は、
  **焼かれていない `/s/<16 桁 hex>/` すべてにシェルを 200 で返す**。
  シェルは fetch に失敗すると「見つかりません」を出す。
  **つまり存在しない id が soft 404 になる**
- 学び:
  - **これは A-5 の欠陥ではなく、静的書き出し＋フォールバックの構造上の
    性質。**nginx はファイルの有無しか見ないので、
    「まだ焼かれていない新しい Story」と「存在しない id」を**区別できない**。
    区別するには nginx から API に問い合わせることになり、
    静的配信の利点を捨てることになる
  - **シェルに `noindex` は付けられない。**シェルは「新しい Story を
    出す」ためのものでもあるので、常に `noindex` にすると
    **焼かれる前の Story が検索に出なくなる**
  - したがって効く手は 1 つ ——
    **フォールバックに落ちている時間を短く保つこと**。
    これは**段階 B の再ビルド間隔の設計そのもの**
  - **被害は限定的**。A-4 でシェル 3 枚を sitemap から外したので、
    Google が自発的に踏むのは**誰かがリンクした URL だけ**

## 39. Google は sitemap の `priority` と `changefreq` を**無視する**と明言している

- 出典: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
  （2026-08-10 確認）
- 事実:
  - 「**Google ignores `<priority>` and `<changefreq>` values.**」
    ＝ 書いても読まれない
  - 「Google uses the `<lastmod>` value **if it's consistently and
    verifiably**（for example by comparing to the last modification of
    the page）**accurate**.」
    ＝ **正確なときだけ使う**。当てにならないと分かれば使われなくなる
  - 「All formats limit a single sitemap to **50MB (uncompressed) or
    50,000 URLs**.」
  - 「**Use fully-qualified, absolute URLs** in your sitemaps.
    Google will attempt to crawl your URLs **exactly as listed**.」
    相対 URL（`/mypage.html`）は使うな、と明記
- 学び:
  - **A-4 で `priority` と `changefreq` を書かない。**Next の
    `sitemap.ts` は `priority` と `changeFrequency` を受け取れるが、
    **読まれないものを埋めると「手入れした」ように見えて実態が無い**。
    数字を並べる誘惑もある（`priority: 0.8` など）が、**根拠が無い**
  - `lastmod` の既存の決め（**`updatedAt` を使う・ビルド時刻を使わない・
    固定ページには出さない**）は、この記述と一致している。
    **ビルド時刻を入れると「毎回全ページが更新された」ことになり、
    consistently accurate ではなくなる**ので、使われなくなる方向に働く
  - **絶対 URL が必須**。CreatorYard は `SITE_ORIGIN` が無いと
    絶対 URL を作れない（`absoluteUrl` が `null` を返す）。
    **相対 URL で誤魔化す道は塞がっている** → 提案 27 へ
  - 上限 **50,000 URL**。CreatorYard の URL 数は
    「Story ＋ ハンドル ＋ タグ ＋ 固定ページ」。撤退条件の規模
    （30 本）では遠いが、**分割が必要になる線が数字で分かった**

## 38. Google は正規 URL の指定手段に**強さの順**を付けている — タグページは URL が増えやすい

- 出典: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
  （2026-08-09 確認）
- 出典: このリポジトリの `app/tags/page.tsx` 18–19 行・`app/w/page.tsx` 18 行・
  `docs/nginx.example.conf` 95–100 行（実物を読んだ）
- 事実（Google）:
  - 正規 URL を伝える手段は 3 つで、**強さの順に並んでいる**:
    1. **リダイレクト** —「A strong signal that the target of the
       redirect should become canonical.」
    2. **`rel="canonical"`** —「A strong signal that the specified URL
       should become canonical.」
    3. **sitemap に載せる** —「**A weak signal** that helps the URLs that
       are included in a sitemap become canonical.」
  - 「These are, in order of how strongly they can influence
    canonicalization」。**組み合わせると強くなる**とも書いてある
  - 指定しなければ Google が「objectively the best version」を自分で選ぶ。
    「none of them are required」ともある（**必須ではない**）
- 事実（このリポジトリの実物）:
  - **タグページは同じ中身に複数の URL が付く。**nginx の経路は
    `^/tags/[^/]+/?$` で**何でも通る**。シェル（`app/tags/page.tsx`）は
    `decodeURIComponent` するだけで**正規化しない**。一方 API 側は
    `normalizeTag` で ASCII を小文字にするので、**`/tags/Godot/` と
    `/tags/godot/` は同じ Story を返す**。末尾スラッシュ無しの
    `/tags/godot` も同じ中身になる（正規表現が `/?` を許している）
  - **個人ページにはこの問題が無い。**`^/w/[a-z0-9][a-z0-9_-]{2,31}/?$` は
    小文字しか通さないので、`/w/Hana/` は nginx が 404 にする
    （末尾スラッシュのゆれだけは残る）
- 学び:
  - **A-3 でタグページを焼くと、URL のゆれがそのまま検索側に出る。**
    焼かれるのは正規化した 1 本だけで、ゆれた URL は try_files で
    シェルに落ちて**同じ中身を別の URL で出す**
  - Google の並びに従うなら**リダイレクトが一番強い**が、それは
    nginx 側＝**段階 B の仕事**。`rel="canonical"` は**焼く側で今すぐ
    入れられる**（A-3 と同じ回でよい）
  - **sitemap は弱い信号**。A-4 で sitemap に正規 URL を並べるだけでは
    足りない、と分かる

## 37. Cloudflare の計測 beacon は **UA によって入ったり入らなかったり**する — 姉妹サービスで実際に確認

- 出典: `https://play-game-yard.com/` を 2026-08-09 に自分で取得して検査
  （公開されている本体。推測ではなく実物）
- 出典: https://developers.cloudflare.com/web-analytics/get-started/
  （2026-08-09 確認）
- 事実:
  - Cloudflare Web Analytics に登録すると、**プロキシ済み（オレンジ雲）の
    サイトでは HTML を触らずに beacon が挿入される**（公式に明記。
    非プロキシのサイトは手で貼るしかない）
  - GAMEYARD（`play-game-yard.com`）で実際に起きていた。トップページに
    `https://static.cloudflareinsights.com/beacon.min.js` の
    `<script type="module">` が入っている
  - **`curl` の既定 UA では入らない**（143,835 バイト）。
    **ブラウザ風の UA を付けると入る**（144,194 バイト）。
    差の 359 バイトがちょうどこの script タグ
  - Web Analytics の一覧では `play-game-yard.com` と
    `gameyard-games.com` の 2 件が「**Automatic setup**」で登録済み。
    どちらも「Created 4 days ago」＝**ドメインを取った直後の流れ**で
    追加されたと見える
  - 同じ画面の Rocket Loader は **Off** だった
- **確かめていないこと**: トップページ以外にも入っているか。
  `/games/` `/about/` は 0 件だったが、**そのページが実在するかを
  確かめていない**ので「入っていない」とは書かない
- 学び:
  - **「第三者 JS を入れない」は、見に行き方によって守れているように
    見える。**素の `curl` で確かめて「無い」と結論づけると通り抜ける。
    **確かめるときはブラウザと同じ UA を付ける**
  - 罠は「勝手に入る」ではなく「**買った直後の流れで追加してしまう**」。
    自動で有効になるのではなく、一度押すと以後ずっと入る
  - CreatorYard は A 案（オレンジ雲）を選んだので、**守るのは
    「Web Analytics に追加しない」の 1 点**。押さないことが操作になる
  - GAMEYARD 側をどうするかは**社長の判断**（別サービスの話）

## 36. OGP の必須項目に **og:image が入っている**（Open Graph 公式＋Meta 公式）— CreatorYard には画像が無い

- 出典: https://ogp.me/ （2026-08-09 確認）
- 出典: https://developers.facebook.com/docs/sharing/webmasters/ （2026-08-09 確認）
- 事実（Open Graph 仕様）:
  - **必須は 4 つ: `og:title` / `og:type` / `og:image` / `og:url`。**
    `og:description` は**任意**
  - `og:url` の説明は「The canonical URL of your object that will be
    used as its permanent ID in the graph」＝**恒久的な ID として使われる**
  - `og:description` の説明は
    「**A one to two sentence description of your object.**」＝ 1〜2 文。
    文字数の上限は書かれていない
- 事実（Meta の webmasters 文書）:
  - `og:description` の推奨は
    「**usually between 2 and 4 sentences**」＝ 2〜4 文。
    **仕様（1〜2 文）と食い違っている。**どちらも文字数は書いていない
  - `og:title` は「**サイト名などのブランドを付けない**記事の題名」
  - `og:url` は「**装飾のない**正規 URL（セッション変数・利用者識別の
    パラメータ・カウンタを付けない）」
  - **`og:image` は URL でキャッシュされ、URL が変わらない限り更新されない**
    （"Images are cached based on the URL and won't be updated unless
    the URL changes."）
  - OGP タグが無いページには「internal heuristics」で推測する、とある。
    **画像が無いときにどう出るかは書かれていない**
- **確かめられなかったこと**: X（旧 Twitter）のカード仕様。
  `developer.x.com` は HTTP 402 を返した。**推測で書かない**（事例 23 の学び）
- 学び:
  - **②の A-2 設計に `og:image` が入っていない。**仕様上は必須の項目で、
    CreatorYard は画像を意図して持っていない（`server/lib/stories.mjs`
    冒頭のとおり、添付は検査を伴うため）。ここは埋める必要がある → 提案へ
  - **`og:description` に「本文冒頭」を入れる決め打ちは、文字数ではなく
    文の切れ目で切るべき**。出典が 1〜2 文と 2〜4 文で割れている以上、
    「n 文字で切る」は根拠が無く、途中で切れた文が外に出る
  - `og:url` は**恒久的な ID** かつ**装飾のない正規形**。このサイトは
    `trailingSlash: true` なので `https://creatoryard.io/s/<id>/` の
    **末尾スラッシュ有りに統一する**（有り無しの 2 通りを作らない）
  - 画像を後から差し替えるなら**ファイル名を変える**必要がある
    （URL でキャッシュされるため）

## 35. metadata は Server Component だけ（Next.js 公式） — 段階 A の前提が 1 つ崩れる
- 出典: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
  （2026-08-09 確認・ページ記載の版は 16.3.0）
- 事実:
  - **「`metadata` オブジェクトと `generateMetadata` 関数の export は
    Server Component でのみサポートされる」**と明記されている
  - 理由も書かれている:「metadata はページのコンポーネントが描画される前に
    サーバーで解決されなければならないから」。そうすることで
    **最初の HTML の応答に metadata を含められる**
  - 公式の回避方法も示されている:「Client Component の機能が要るなら、
    **`page.tsx` は Server Component のままにして、Client Component の
    ロジックを別ファイルへ移す**」
  - metadata は `layout.js` と `page.js` に置ける。
    **同じ route segment から `metadata` と `generateMetadata` の両方は
    export できない**
- 学び:
  - **CreatorYard の焼き込み対象 3 枚は全部 `'use client'`**
    （`app/s/page.tsx`・`app/w/page.tsx`・`app/tags/page.tsx` の 1 行目。確認済み）。
    一方、公開運用設計 段階 A は**この 3 枚に Story 固有の OGP を
    metadata API で出す**前提で書かれている。**そのままでは両立しない**
  - 直し方は公式が書いているとおりで、**`page.tsx` をサーバー側に戻し、
    いまの中身を `_client.tsx` 等へ移して読み込む**。
    `generateStaticParams` と `generateMetadata` は `page.tsx` に置く
  - **シェル＋fetch の仕組みは壊さない**（クライアント側は別ファイルに
    移るだけ）。焼き込み後に増えた Story がシェルに落ちる経路（try_files）も
    そのまま
  - これは**実装前に潰せる穴**。③が段階 A に着手した瞬間に踏むので、
    先に設計へ反映しておく（提案 20:16）

## 34. #100DaysOfCode（公式） — 続ける仕掛けが「順位」ではなく「宣言と応援」
- 出典: https://www.100daysofcode.com/ （2026-08-09 確認）
- 事実:
  - 規則は 2 つ。**(1) これから 100 日、毎日最低 1 時間コードを書く。
    (2) 毎日 `#100DaysOfCode` を付けて進み具合を投稿する**
  - 参加者には「**同じ挑戦をしている人を励ます**」ことが求められている
    — 更新を投稿している人に声をかけ、うまくいかないときに支える
  - **挑戦することを公に宣言する**（宣言の投稿をする）ことが勧められており、
    それが「**責任を持つこと**」につながるとされている
- 学び:
  - **順位・点数・称号がどこにも出てこない。**続ける力の源は
    **「公に宣言したこと」と「他の参加者からの応援」**の 2 つだけで組まれている。
    CreatorYard の決定「数字を競争にしない」（2026-08-06）と**同じ側の設計**で、
    それでも 100 日続ける人が出る仕組みが成立している、という実例
  - **日付ではなく「連番」で数えている**のも特徴（Day 37 のように）。
    休んだ日があっても番号は自分で持つので、
    **連続記録が途切れて終わる形になっていない**
  - CreatorYard は**発信の場を持たない**（X は本人の外）ので、この型を
    そのまま持ち込めない。ただし**タグ（つまずきタグ）は既にある**ので、
    書き手が自分で名乗る「まとまり」を作れる素地はある
  - **いまは提案しない。**「タグで挑戦のまとまりを作る」類は
    **機能としては何も足さずに始められる**（既存のタグで足りる）ので、
    公開後に書き手の使い方を見てからで遅くない。
    公開前に仕組みを先回りして作ると、使われない画面が増える

## 33. Global Game Jam（公式） — 毎年 1 月最終週・48 時間・世界で 3.5 万人規模
- 出典: https://globalgamejam.org/about （2026-08-09 確認）
- 事実:
  - GGJ はカリフォルニア州登録の **501(c)(3) 非営利団体**が運営。
    使命は「安全で歓迎される環境で、ゲームという媒体を通じて
    世界中の個人が学び・試し・共に作れるようにすること」
  - **毎年 1 月の最終週**に開催。**48 時間**で作る
    （金曜の夕方から日曜の午後まで）
  - **2025 年 1 月の規模**: 「**97 か国 803 会場で 35,000 人以上**が
    **48 時間で 12,000 本**のゲームを作る」。累計では
    「**485,000 人以上**が参加し、**100,000 本以上**のゲームが生まれた」
  - 会場は**物理・オンラインの両方**（「数百の physical and virtual sites」）
- 学び:
  - ジャム連動発信の提案（20:12・**人待ち**）には具体的な時期が無かった。
    **GGJ は「毎年 1 月最終週」で固定**なので、**公開時期が決まれば
    逆算できる**（次に来るのは 2027 年 1 月最終週）
  - ただし **48 時間**の催しなので、**制作記録を毎日書く題材にはなりにくい**。
    itch.io の devlog が育つのは会期の長いジャム（事例 14）で、
    **CreatorYard に効くのは「長い会期のジャム」のほう**という見立てが立つ。
    unityroom の 1 週間ジャムのような**日単位で進む催し**を先に見るべき
  - 規模の数字は**書き手の母数の目安**として使えるが、
    **CreatorYard の画面には出さない**（数字を競争にしない。決定 2026-08-06）。
    使うのは発信の時期を決めるためだけ
  - **公開時期が未定のうちは、これ以上の調査を広げない**。時期が決まってから
    「その時期に会期のあるジャム」を当たるほうが、確かめ直しの手間が要らない

## 32. Web Share API（MDN） — 依存を足さずに「共有」を出せるが、全部の環境では動かない
- 出典: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
  （2026-08-09 確認）
- 事実:
  - `navigator.share()` は**端末が持っている共有の仕組み**を呼び出し、
    文字列・URL・ファイルを渡せる。渡し先は端末次第で、クリップボード・
    連絡先・メール・各種サイト・Bluetooth などがありうる
  - 呼び出しの条件が 3 つ: **安全なコンテキスト（HTTPS）**、
    **一過性のユーザー操作**（ボタン押下などが要る。スクリプトから
    勝手には呼べない）、**`web-share` の Permissions Policy** が
    許可されていること
  - **Promise を返す**。Windows では共有のポップアップが出た時点、
    Android では共有先へ渡し終えた時点で解決する
  - 失敗の型: **`AbortError`**（利用者が取りやめた、**または共有先が
    1 つも無い**）、`TypeError`（引数が無い・未知の項目だけ）ほか
  - **ページに明記あり**:「**この機能は Baseline ではない — 最も広く
    使われているブラウザのいくつかでは動かない**」
- 学び:
  - **第三者 JS も依存も足さずに実装できる**（ブラウザ内蔵の API）。
    決まりの「依存を増やさない・第三者 JS を入れない」に触れない
  - 効きそうな場所は**公開の成功画面**。集客チャネル決定の「X」は
    書いた本人が URL を貼るところから始まる（提案 12:12）。
    携帯では共有シートが出るぶん、URL を選んでコピーするより短い
  - ただし**動かない環境がある**と公式に書かれているので、
    **押せない/出ないときに詰まらない形**が必須。
    いまの「公開した記録を見る」等のリンクは**そのまま残す**前提で、
    共有ボタンは**あれば出る**扱いにする（datalist と同じ劣化の考え方。事例 19）
  - **HTTPS が要る**ので、動きの確認は公開後（または証明書を入れた
    ステージング）でしかできない。**公開前に作っても確かめられない**
  - 以上より**いまは提案しない**。壊れているものではなく良くする話で、
    しかも確認手段が公開まで無い（⑤ 11:51 の線引き）。
    公開時期が決まったときの材料として置く

## 31. `<textarea>` の `maxlength`（MDN） — 指定しなければ上限は無い
- 出典: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea
  （2026-08-09 確認）
- 事実:
  - `maxlength` は**利用者が入力できる最大の長さ**を決める。
    数え方は文字数ではなく **UTF-16 のコード単位**
  - **`maxlength` を指定しなければ、利用者は無制限に入力できる**
  - `minlength` は「下回っても入力自体は止めないが、値を無効にする」。
    ただし `required` が無ければ**空は有効のまま**。つまりこれらの属性は
    **送信時の妥当性**に効くもので、入力そのものを常に妨げるわけではない
- 学び:
  - CreatorYard の `/write` の本文欄には **`maxLength` が付いていない**
    （`app/write/page.tsx` 312 行の `<textarea>`。確認済み）。
    サーバー側は `LIMITS.body = 20,000` で弾く
  - つまり **20,000 を超えて書いた人は、書き終えて保存を押した瞬間に
    初めて拒まれる**。長い制作記録ほど起きやすい
  - **書いた内容が消えるわけではない**（送信前の控えが localStorage に
    残る。投稿成功まで消さない作りになっている）ので、**壊れてはいない**。
    直すとすれば「上限に近づいたら知らせる」という**良くする話**で、
    ⑤ 11:51 の線引きでは静穏運転中に手を付ける対象ではない
  - **数え方の違いも覚えておく**: サーバーは JS の文字列長で数えており、
    `maxlength` と同じ UTF-16 コード単位。**絵文字は 2 と数えられる**ので、
    もし表示上の「文字数」を出すなら、この差を説明できる形にすること

## 30. Cache-Control（MDN） — `no-cache` は「保存するな」ではない
- 出典: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
  （2026-08-09 確認）
- 事実:
  - **`no-cache`** は「保存してよいが、**再利用の前に必ず元のサーバーへ
    確認する**」。ページには明示的に
    「**`no-cache` は『キャッシュするな』という意味ではない**」とあり、
    本当に保存させたくないなら **`no-store`** を使う、と書かれている
  - **`no-store`** は「**どんなキャッシュ（私用・共用とも）も保存しない**」
  - **`max-age=N`** は「応答が**生成されてから** N 秒は新鮮」。
    受け取ってからの経過時間ではない（途中のキャッシュが持っていた
    `Age` の分は差し引かれる）
  - **`immutable`** は「新鮮なあいだ更新されない」。
    **一般的な作法として**、静的資源の URL にバージョンやハッシュを含めて
    中身は決して書き換えず、更新時は**別の URL** にする方法
    （**cache-busting**）が挙げられており、これと長い `max-age` を
    組み合わせるときに `immutable` を足せば再確認を省ける
- 学び:
  - **CreatorYard の `docs/nginx.example.conf` にはキャッシュの指定が
    1 行も無い**（47 行・`add_header` も `expires` も無し。確認済み）。
    公開すると**すべてが nginx の既定の振る舞い任せ**になる
  - 一方、Next の静的書き出しは**すでに cache-busting の形**になっている。
    `out/_next/static/chunks/255-2b334ff5c2ee7a81.js` のように
    **ファイル名にハッシュが入る**。上の作法がそのまま当てはまる資源が
    既に手元にある
  - 逆に **`/s/<id>/` や `/stories/` の HTML は「シェル」で中身が
    後から変わる**（fetch で描く。焼き込み後は内容そのものが変わる）ので、
    同じ扱いにはできない。**面ごとに分けて決める必要がある**
  - 公開運用設計（designs 03:22）に**キャッシュの節が無い**ので、
    社長の公開判断が出たときの材料として、この事実を置いておく

## 29. PUT の意味（MDN） — 送った内容で「置き換える」
- 出典: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/PUT
  （2026-08-09 確認）
- 事実:
  - **PUT は、対象の資源を新しく作るか、その表現を
    「リクエストの内容で置き換える（replaces）」**
  - POST との違いは**べき等であること**。「1 回呼ぶのと、続けて何回か
    呼ぶのとで違いが無い（副作用が無い）」
  - **このページに PATCH との比較や「部分更新」の記述は無い**
    （確かめられなかったので、そう書かない）
- 学び:
  - CreatorYard の `PUT /api/stories/<id>` は**置き換えの意味で正しい**。
    そして実装も実際に置き換えになっている — `normalizeInput` が
    **毎回すべての項目を作る**ので、`{...current, ...normalizeInput(input)}`
    は事実上の全置き換えになる（`server/lib/stories.mjs` 86–116・173–189 行）
  - **つまり送らなかった項目は消える。** 編集モード（designs 13:21 段階 B）は
    **フォームの全項目を必ず送る**必要がある。とくに `visibility` を
    送り忘れると `'draft'` になり、**公開済みの記録が黙って非公開に戻る**
    （提案 14:15）

## 28. localStorage の性質（MDN） — 保存先はオリジンに 1 つ、期限は無い
- 出典: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
  （2026-08-09 確認）
- 事実:
  - `localStorage` は**その文書のオリジンに対する `Storage` オブジェクト**を
    返す。保存された値は**ブラウザのセッションをまたいで残る**
  - **プロトコルまで含めて別扱い**。`http://example.com` と
    `https://example.com` では**別のオブジェクト**が返る
  - `sessionStorage` との違いは期限。**`localStorage` の値に有効期限は無い**
    （プライベートブラウジングの場合は、最後のプライベートタブを閉じたときに消える）
  - キーと値は **UTF-16 の文字列**として保存される（整数キーは文字列に変換される）
  - このページには**容量の上限や「機微な情報を置くな」といった記述は無い**
    （確かめられなかったので、そう書かない）
- 学び:
  - **保存先はオリジンに 1 つで、鍵の名前がぶつかれば上書きされる。**
    CreatorYard の `/write` は書きかけを `cy.write.draft` という
    **固定の鍵 1 つ**に自動保存している（`app/write/page.tsx` 15 行目）。
    **編集モードを作るとき、この鍵をそのまま使うと事故になる**
    （Story A を編集中の内容が、次に新規で開いたときに出てくる。提案 13:13）
  - 期限が無いので、**消す責任は書いた側にある**。いまは投稿成功時に
    `removeItem` していて正しい（180 行目）

## 27. ユーザビリティの 10 原則（Nielsen Norman Group） — 1 番目が「今どうなっているかを見せる」
- 出典: https://www.nngroup.com/articles/ten-usability-heuristics/ （2026-08-09 確認）
- 事実:
  - 10 原則の 1 番目は **Visibility of System Status（システム状態の可視性）**。
    「**設計は常に、適切なフィードバックによって、妥当な時間内に、
    いま何が起きているかを利用者に知らせ続けるべきである**」。
    助言として「**フィードバックはできるだけ速く（理想的には即座に）
    利用者に示す**」
  - 3 番目は **User Control and Freedom（利用者の制御と自由）**。
    「利用者はしばしば操作を誤る。**長い手順を踏まずに、望まない操作から
    抜け出せる、はっきり示された非常口が要る**」
  - 残りは 2 実世界との一致 / 4 一貫性と標準 / 5 エラーの予防 /
    6 記憶より認識 / 7 柔軟性と効率 / 8 美的で最小限の設計 /
    9 エラーからの回復支援 / 10 ヘルプと文書
- 学び:
  - **「公開しました」だけでは 1 番目を満たしていない。**「公開された」と
    文字で言うことと、**公開されたものを見せること**は別。制作記録は
    人に見せるために書くので、**どう見えているかを確かめられて初めて
    状態が伝わった**と言える（提案 12:12）
  - 3 番目は投稿画面にも効く。いまの「公開しました」の画面から**戻る道が
    `もう 1 本書く` しか無い**のは、非常口が 1 つも無い状態に近い

## 26. `<nav>` 要素（MDN） — 「主要な案内」の置き場所は既にある
- 出典: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/nav
  （2026-08-09 確認）
- 事実:
  - `<nav>` は「**現在の文書内あるいは他の文書への案内リンクを提供することを
    目的とした区画**」を表す。メニュー・目次・索引が典型例
  - **すべてのリンクを `<nav>` に入れる必要はない**。`<nav>` は
    「**主要な案内リンクのまとまり**」のためのもので、`<footer>` に並ぶ
    リンク群は `<nav>` に入れなくてよい、と明記されている
  - スクリーンリーダーなどの利用者エージェントは、この要素を使って
    **案内だけの内容を最初の読み上げから省くかどうかを判断できる**
  - 1 つの文書に複数の `<nav>` を置いてよい（サイト案内とページ内案内など）。
    その場合は `aria-labelledby` で区別するとよい
- 学び:
  - CreatorYard には**すでに `<nav class="site-nav"
    aria-label="メインナビゲーション">` がある**（`app/layout.tsx`）。
    新しい部品を作る必要はなく、**中身を足すだけ**で「主要な案内」になる
  - ただし現状、その中に入っているリンクは **GAMEYARD への外部リンク 1 本だけ**。
    「メインナビゲーション」と名乗る区画から辿れるのが**サイトの外だけ**という
    状態になっている（提案 11:12）

## 25. 空の状態（empty state）の設計（Nielsen Norman Group） — 何もない画面こそ次の一手を出す
- 出典: https://www.nngroup.com/articles/empty-state-interface-design/ （2026-08-09 確認）
- 事実:
  - 空の状態を 3 種類に分けている。**まだ何も設定していないための空**
    （お気に入り未登録・ダッシュボードが空など）、**検索結果が 0 件の空**、
    そして**紛らわしい空**（読み込みが終わる前に「該当なし」と出してしまう）
  - 意図して設計された空の状態は 3 つの役割を果たす。(1) **システムの状態を
    伝える**（「選択した期間に表示するレコードはありません」の一文で
    利用者の確信が増す）、(2) **その場で学べる手がかりを出す**
    （必要になった時にだけ現れるので割り込みにならない）、
    (3) **主要な作業に取りかかる直接の道筋を出す**（ボタンやリンクで
    その作業を始められるようにする）
  - 文脈内のヘルプは「その場ですぐ使えるので記憶に残りやすい」と述べ、
    強制的なチュートリアルと対比している
- 学び:
  - CreatorYard の一覧・タグ・個人ページの空の状態は**すでに (1)(3) を
    満たしている**（「まだ Story がありません。最初の 1 本が…」＋
    `/write/` へのリンク）。読み込み中に「ありません」と出す**紛らわしい空**も
    避けられている（`list &&` で読み込み完了を待ち、取得失敗は別に出す）
  - **満たせていないのは「登録・ログインの直後」**。ここは空の一覧より
    強い意図を持った利用者がいる場面なのに、次の道筋が出ていない（提案 10:14）

## 24. sitemap の作り方（Google 公式） — lastmod は「正確なときだけ使われる」
- 出典: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
  （2026-08-09 確認）
- 事実:
  - 送信方法として案内されているのは 2 つだけ。**Search Console の
    サイトマップレポートから送る**（取得日時と処理エラーが見られる）か、
    **robots.txt に `Sitemap: https://example.com/my_sitemap.xml` の 1 行を
    どこかに置く**か。このページに HTTP の ping で知らせる方法の記載はない
  - `<lastmod>` は「そのページの**最後の重要な更新**の日時」を入れる。
    Google は **「一貫して、検証可能な形で正確なとき」にだけ lastmod を使う**
    （ページの実際の更新と突き合わせて確かめる、と明記）。本文・構造化データ・
    リンクの変更は重要な更新にあたるが、**著作権表示の年だけの変更は
    重要な更新ではない**
  - 1 ファイルの上限は **50MB（非圧縮）または 50,000 URL**。超える場合は
    分割する
- 学び:
  - 送信は robots.txt の `Sitemap:` 行で足りる（設計済み）。Search Console は
    エラーが見える利点があるが**アカウントが要る**ので社長判断（要判断）
  - **危ないのは lastmod の作り方**。焼き込みは全ページを毎回書き出すので、
    ファイルの更新時刻やビルド時刻から lastmod を作ると**全ページが
    毎回「更新された」ことになり、実際の更新と合わない**。Google の
    「一貫して正確なときだけ使う」に引っかかり、lastmod 自体が無視される
  - 上限 50,000 URL は MVP の規模では当たらない。**分割の仕組みは作らない**
    （撤退条件が「30 日で書き手 10 人」である以上、当面は桁が違う）

## 23. Let's Encrypt のレート制限（公式） — 公開当日にやり直せる回数は有限
- 出典: https://letsencrypt.org/docs/rate-limits/ （2026-08-09 確認）
- 事実: **同一の識別子セット（＝同じドメインの組み合わせ）は 7 日で 5 枚**まで。
  登録ドメインあたり 7 日で 50 枚。1 アカウントは 3 時間で 300 注文まで。
  認証の失敗は 1 時間・識別子あたり 5 回まで。開発・試験用に
  **制限の緩いステージング環境**の利用が推奨されている。
- 学び: 公開当日に「証明書を取り直す」試行は**実質 5 回**しかできない
  （同じドメイン構成の場合）。GAMEYARD の公開（8/5〜06）は通ったが、
  CreatorYard は**別ドメイン・別構成**なので同じ手順が通る保証はない。
  本番前に**ステージング環境（--dry-run 相当）で 1 回通す**のを手順に
  組み込むべき。設定ミスで 5 回を使い切ると 7 日待ちになる。

## 22. Next.js Static Exports の制約（公式ドキュメント） — 焼き込み設計の前提
- 出典: https://nextjs.org/docs/app/guides/static-exports （2026-08-09 確認）
- 事実: `output: 'export'` は route ごとに HTML を `out/` に生成する。
  **サポートされない機能**に **ISR（Incremental Static Regeneration）**、
  `dynamicParams: true` の動的ルート、`generateStaticParams()` の無い動的ルート、
  Request に依存する Route Handler、cookies、rewrites / redirects / headers、
  既定 loader の画像最適化、Server Actions が明記されている。
  Route Handler は **GET のみ**で、`export const dynamic = 'force-static'` を
  付ければ静的ファイル（JSON/TXT 等）として焼ける。公式に nginx の
  `try_files $uri $uri.html $uri/ =404` の例が載っている。
- 学び: 公開運用設計（designs 03:22）の前提が一次資料で裏付けられた。
  (1) **ISR が使えない**ので「投稿のたびに部分再生成」は選べず、
  定期ビルド＋手動トリガという判断が正しい。(2) `dynamicParams: true` が
  使えないため、**焼き込み後に増えた Story は静的側に存在しない**
  → nginx の try_files でシェルに落とす経路が必須（設計の補強点）。
  (3) sitemap / robots は force-static の Route Handler で焼ける。
  (4) rewrites / headers は Next 側で書けないので nginx が担当（現行どおり）。

## 21. robots.txt（Google の一次資料） — 役割の誤解が多い基本設定
- 出典: https://developers.google.com/search/docs/crawling-indexing/robots/intro
  （2026-08-09 確認）
- 事実: robots.txt は「クローラがどの URL にアクセスできるか」を伝える
  ファイルで、主目的はサーバー負荷の管理。ルート直下に置く。**検索結果から
  ページを隠す用途には使えない**（他サイトからリンクされていれば
  ブロック対象でも結果に出得る。隠すなら noindex かパスワード保護）。
  全クローラが遵守するわけでもない。
- 学び: 公開準備では「全部クロール許可＋sitemap の場所を書くだけ」の
  最小 robots.txt が正解（隠したいものはそもそも公開側に無い設計に
  してある — 下書きは API 認可で守られており robots に頼らない）。
  「見つかる面」は OGP・RSS・sitemap・robots の 4 点セットになった。

## 20. sitemaps.org プロトコル — 検索エンジンに面を伝える最小要件
- 出典: https://www.sitemaps.org/protocol.html （2026-08-09 確認）
- 事実: 必須は `<urlset>`・`<url>`・`<loc>`。1 ファイル上限は URL 5 万件・
  50MB（圧縮前）。lastmod は W3C Datetime（YYYY-MM-DD で可）。置き場所が
  対象範囲を決める（ルート直下に置けばサイト全体を掲載できる）。
- 学び: タグ SEO（ACQUISITION A1）を面として効かせるには、Story・タグ・
  個人ページの URL を sitemap で検索エンジンに伝える必要がある。上限
  5 万件は当面問題にならない。lastmod に Story の updatedAt がそのまま
  使える。**静的焼き込み（公開運用）設計の必須要件**として持っておく。

## 19. HTML の datalist — 依存なしで作れるタグ入力の候補提示
- 出典: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/datalist
  （2026-08-08 確認）
- 事実: `<datalist>` は `<option>` の集合を持ち、`<input list="...">` と
  id で結びつけると入力欄に候補を出せる標準要素。MDN の対応状況は
  「Limited availability」（全ブラウザで動くわけではない）と明記。
- 学び: タグ入力の補完を**依存ゼロ**で足せる。非対応ブラウザでは
  ただの input に落ちるだけで入力自体は壊れない（敷居を上げない劣化）。
  つまずきタグ UI（実装順④）は「素の input＋datalist 候補」で始めるのが
  方針（依存を増やさない）と噛み合う。

## 18. RSS 2.0 仕様と autodiscovery — 段階 C の実装が守るべき最小要件
- 出典: https://www.rssboard.org/rss-specification /
  https://www.rssboard.org/rss-autodiscovery （2026-08-08 確認）
- 事実: channel の必須は title・link・description の 3 つ。item は全要素
  任意だが **title か description の少なくとも一方が必須**。日時は RFC 822
  形式（例: `Sat, 07 Sep 2002 00:00:01 GMT`）。autodiscovery は HTML の
  `<head>` に `<link rel="alternate" type="application/rss+xml" href="…">`
  （rel・type は小文字）。1 ページ 1 リンクが推奨で、複数あるときは
  最初がメインフィード。
- 学び: RSS を自前で組む際の正誤の基準がこの 2 ページで足りる。
  autodiscovery の link は layout に 1 本（全体フィード）、個人ページには
  その書き手のフィードを置くのが素直（ページごとに「最初のリンク」を
  そのページのメインにする）。

## 17. Open Graph protocol — シェアカードは head の静的な meta が前提
- 出典: https://ogp.me/ （2026-08-08 確認）
- 事実: ウェブページを SNS 上のリッチなカードにするための仕組み。必須の
  meta は og:title / og:type / og:image / og:url の 4 つで、HTML の
  `<head>` 内に書く必要がある。
- 学び: SNS のクローラの多くは JS を実行しないため、**静的シェル＋fetch の
  ページでは Story 固有のシェアカードを出せない**（head が全ページ共通に
  なるため）。X でのシェアが集客チャネルにある以上、Story 固有の OGP は
  静的焼き込み（公開運用の再ビルド体制）側の仕事として設計に含めるべき
  制約。段階 B ではサイト共通の OGP だけ置くのが正しい割り切り。

## 16. Lobsters — サイト全体・タグ別・複数タグの RSS を全面に出す一覧サイト
- 出典: https://lobste.rs/about （2026-08-08 確認）
- 事実: コンピューティング系のリンク集約コミュニティ。サイト全体・タグ別・
  複数タグ組み合わせの RSS を公開し、ログイン時は個人フィルタ反映の
  非公開フィードもある。招待制で、モデレーション行動はすべて公開。
- 学び: **一覧と RSS は対で設計する**のが小さなコミュニティサイトの定石
  （全体だけでなくタグ別まで）。RSS 提案（proposals 19:12）の裏付け。
  タグ別 RSS はつまずきタグ（実装順④）実装時の拡張として URL の形だけ
  先に決めておくと後で壊れない。

## 15. itch.io の devlog 横断一覧 — 投稿タイプで絞れる新着面
- 出典: https://itch.io/devlogs （2026-08-08 確認）
- 事実: サイト横断の devlog 一覧ページがあり、並び順は既定
  「New and popular」のほか「Most recent」「Most popular」を選べる。
  絞り込みは投稿タイプ（Major Update・Postmortem・Game Design 等）と
  プロジェクトタイプ。
- 学び: 制作記録の横断一覧は「新着」だけでも面として成立する。
  CreatorYard は数字を競争にしない決定により **Most popular 型の並びは
  採らず、新着順のみで始める**（対比として記録）。「投稿タイプ」の絞りは
  つまずきタグ 2 軸で置き換えられる。

## 14. itch.io のジャム — 誰でも主催でき、累計 58.5 万作品を生む書き手の供給源
- 出典: https://itch.io/jams （2026-08-08 確認）
- 事実: 「Anyone can instantly create and host a jam」と明記され、誰でも
  ジャムを主催できる。掲載ジャムは数百件以上、参加規模は 2 人〜37,422 人
  （GMTK Game Jam 2026）まで幅広い。累計 585,683 作品がジャム発。
- 学び: ジャムは「作りかけ・短期間・つまずきだらけ」の制作を大量に生む
  ＝ **Creator Story の書き手がいちばん密集している場所**。集客チャネル
  決定（GAMEYARD 内導線 → Discord → X → ジャム → タグ SEO）の「ジャム」は
  時期を合わせた発信が効く（ジャム中は毎日書く題材がある）。

## 13. はてなブログ — 「読者になる」という軽い購読が再訪問を作る
- 出典: https://help.hatenablog.com/entry/about （2026-08-08 確認）
- 事実: 無料のブログサービス。専用ブログ（独自ドメイン可）を持て、
  「読者になる／読者をやめる」という購読機能がある（詳細説明は
  このページには無いので書かない）。
- 学び: 個人ページに「また読みに来る」経路が付いていることが定着の装置に
  なっている。CreatorYard の MVP はフォローを持たない（読者機能は書き手が
  付いてから）ので、**アカウント不要の再訪問経路（RSS など）**が
  個人ページ設計の論点になる。

## 12. note — 大手は人気の可視化を持つ（CreatorYard が持たない側の確認）
- 出典: https://note.com/ （2026-08-08 確認）
- 事実: 「つくる、つながる、とどける」を掲げる投稿プラットフォーム。
  トップに「急上昇」の項目とトレンドタグが並び、注目コンテンツを
  可視化する仕組みがある。
- 学び: 日本最大級の書き場は人気の可視化（急上昇）で回っている。
  CreatorYard は**それを持たないことが決定**（数字を競争にしない）で、
  しずかなインターネット（事例 6）側の系譜に立つ。同じ土俵で戦わない
  という選択の輪郭がはっきりする対比事例。

## 11. mataroa.blog — 機能を削ることを明言して成立するブログ基盤
- 出典: https://mataroa.blog/ （2026-08-08 確認）
- 事実: 「最小限主義者向けの裸のブログプラットフォーム」。広告なし・
  追跡ゼロ（分析/追跡クッキーなし）・重い JS を入れない方針を明言。
  テーマ・リッチエディタ・タグ・ページネーションを**意図して採用しない**
  と公表。無料＋年額 9 ドルのプレミアム。
- 学び: 「入れない機能の一覧を公開する」ことが信頼の売りになる実例。
  CreatorYard の「MVP に入れないもの（理由つき）」（SPEC §1）と同じ型。
  ただし mataroa はタグも捨てているのに対し、CreatorYard はつまずきタグを
  検索流入の面として残す——削り方の線引きが違う点も含めて参考になる。

## 10. Write.as — 追跡なし・書くことだけに絞った基盤（自動保存つき）
- 出典: https://write.as/ （2026-08-08 確認）
- 事実: 「Built entirely around privacy」を掲げるブログ基盤。追跡・過剰な
  データ収集をしない・広告なし。ペンネーム・匿名投稿に対応。エディタは
  Markdown／リッチテキストで、**ブラウザへの自動保存**がある。RSS 対応。
- 学び: 書く画面で「書きかけが消えない」（自動保存）は、この種の
  ミニマル基盤でも外していない基本機能。Story 投稿フォームでも
  ブラウザ側の自動保存（サーバーに送らない下書き控え）は入れる価値がある。

## 9. dev.to のタグ — タグに説明文を持たせて入口ページにしている
- 出典: https://dev.to/tags （2026-08-08 確認）
- 事実: タグは技術名（JavaScript・Python・Rust 等）・フレームワーク・
  概念（AI・DevOps 等）の単位。#webdev 40 万件・#ai 34 万件など。
  ほぼすべてのタグに短い説明文が付いている（#python は「import antigravity」
  のような遊びも含む）。
- 学び: タグは一覧の絞り込みだけでなく、**説明文つきの入口ページ**として
  作ると検索の面になる。つまずきタグ（SPEC 実装順④）でタグページを作る際、
  1 行説明を持てる形にしておく価値がある。

## 8. Qiita のタグ — ツール名タグが検索・分類の主単位として成立
- 出典: https://qiita.com/tags （2026-08-08 確認）
- 事実: タグの大半は言語・ツール・フレームワーク名（Python 10.4 万件、
  JavaScript 6.5 万件、AWS 5.8 万件…）。上位 30 タグは 5,000 件以上。
  概念タグ（初心者・セキュリティ等）も並ぶ。
- 学び: 「ツール名」タグは日本圏の書き手に馴染んだ分類単位で、
  SPEC のつまずきタグ 2 軸のうち「ツール名」軸の実在の裏付けになる。
  もう 1 軸（つまずき・トピック）を重ねるのが CreatorYard の差分。

## 7. WIP（wip.co） — 毎日の小さな進捗共有と、その裏の競争圧
- 出典: https://wip.co/ （2026-08-08 確認）
- 事実: 独立系メーカー向けの招待制コミュニティ。「毎日の増分的な進捗」を
  短く投稿する形式で、「Ship every day」を掲げる。開発タスクから生活の
  記録まで並ぶ。フィードバック・週次ハングアウト等が特典
  （streak の具体的仕組みはトップページからは確認できず、書かない）。
- 学び: 「小さな進捗を毎日書く」は継続を生む型として実在する。一方で
  「毎日」を掲げる設計は書けない日をプレッシャーに変える側面がある。
  CreatorYard は連続日数の表示や streak を作らない（数字を競争にしない）
  前提で、「小さく書ける」の部分だけを取り込むのが整合的。

## 6. しずかなインターネット — 「読まれなくていい」を売りにする書き場
- 出典: https://sizu.me/ （2026-08-08 確認）
- 事実: catnose 運営の「日記やエッセイを書くのにちょうどいい、文章
  書き散らしサービス」。「たくさんの人に読まれなくていい」を明示的に
  掲げる。有益な情報である必要もないとする。
- 学び: **数字を競わない・読まれる圧を下げる思想は、それ自体が
  サービスの売りになる**（日本圏で実例が動いている）。CreatorYard の文化
  （完成度で人を落とさない・数字を競争にしない）は同じ系譜で、
  それを画面の文言で明示することに価値がある。

## 5. Wikipedia — ユーザー名＋パスワードだけで参加でき、メールは選択制
- 出典: https://en.wikipedia.org/wiki/Help:Logging_in （2026-08-08 確認）
- 事実: アカウント作成は「ユーザー名とパスワードを提供する」と説明され、
  メールは「If you choose to give an email address」と選択制の書き方。
  用途はパスワード回復・他ユーザーからの連絡・ログイン確認と説明されている。
- 学び: 世界最大級の投稿コミュニティでも登録の必須項目は 2 つで成立している。
  CreatorYard の「ハンドル＋パスワード・メール任意」（SPEC §1）は
  特殊な設計ではなく、実績のある型。メールの用途を先に明示するのが誠実。

## 4. Hacker News — メール任意の運用を FAQ に明記して長年成立
- 出典: https://news.ycombinator.com/newsfaq.html （2026-08-08 確認）
- 事実: 公式 FAQ が、パスワード再設定は「プロフィールにメールがあれば」
  できる（"If you have an email address in your profile, you can do that
  here"）とし、無い場合は hn@ycombinator.com への連絡でサポートすると明記。
- 学び: メール未登録の人の**復旧経路まで含めて**運用が設計されている。
  メール任意にするなら「無い人がパスワードを失ったらどうなるか」を
  最初に決めて明記しておく必要がある（アカウント設計の論点）。

## 3. Ci-en — 「活動日記」が外部支援への入口になっている
- 出典: https://ci-en.net/ （2026-08-08 確認）
- 事実: EISYS Inc.（DLsite 等の運営元）のクリエイター支援サービス。
  「活動日記も月額プランも」と掲げ、日記的投稿と月額支援が同じ場にある。
  支援は「いいねやコメントから、月額プラン支援まで」の段階式。
- 学び: 日本圏では**制作の記録そのものがファンと支援を集める入口**として
  成立している。CreatorYard は決済を持たない（D-CY4=C）ので、Story・
  プロフィールに本人の Ci-en/Booth 等の外部リンクを置く型がこれと噛み合う。

## 2. Zenn のスクラップ — 「記事」より敷居の低い進行中ログが別形式で成立
- 出典: https://zenn.dev/zenn/articles/about-zenn-scraps （2026-08-08 確認）
- 事実: スレッド形式で知見やメモを段階的に足していく機能。公式が
  「今まさに取り組んでいる物事や、まだ解決方法が分かっていない問題、
  学習ログを気軽に残す」用途と説明し、完成した「記事」と明確に区別。
  スクラップには Open / Closed の解決状態がある。
- 学び: **書き終えてから出す「記事」と、進行中に足していく「ログ」は別物**で、
  後者は敷居の低さで成立している。Story の書式設計（小さく足せる・
  つまずきに未解決/解決の状態を持てる）の直接の根拠になる。

## 1. itch.io の devlog — 作品ページに紐づく制作記録が大量に書かれている
- 出典: https://itch.io/updates （itch.io 公式ブログ。2026-08-08 確認）
- 事実: devlog は「開発者がプロジェクトについて頻繁に更新・画像・動画を
  共有する手段」で、作品ページの一部として機能する。2017 年 5 月の公式
  投稿時点で 15,000 プロジェクト・42,000 件以上の投稿があった。
- 学び: 制作記録は**作品に紐づくと書かれる**（作品を届ける場と作る人の
  記録が地続き）。GAMEYARD（作品）と CreatorYard（記録）の姉妹構成は
  この型に一致する。作品との相互リンクは MVP 後の導線として有望。

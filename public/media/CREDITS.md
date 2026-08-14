# 背景動画の素材と権利（Issue #12 の要求による記録）

`hero.mp4` / `hero.webm`（27 秒・9 カット・無音）と `hero-poster.jpg` は
以下の素材から 2026-08-14 に制作した。

## 本番利用を止めている権利確認（2026-08-14）

配布ページを再確認した結果、カット 3・4・6・7 の無料版は
**Mixkit Restricted License（個人利用のみ）**だった。CreatorYard での
公開利用はできないため、商用利用可能な素材へ差し替え、各配布ページを
再確認するまで `RIGHTS_APPROVED` を置かない。アプリはこのファイルがない
限り video 要素を生成しない。

## カット 1〜7: Mixkit 素材（取得日 2026-08-14）

| カット | 内容 | 配布ページ | 2026-08-14 の表示 |
| --- | --- | --- | --- |
| 1 | 東京の夜景（レインボーブリッジ） | https://mixkit.co/free-stock-video/city-of-tokyo-at-night-4383/ | Free License（商用可） |
| 2 | PC を操作する手元 | https://mixkit.co/free-stock-video/close-up-shot-of-a-person-typing-on-a-laptop-1808/ | Free License（商用可） |
| 3 | 韓国・ソウルの夜景（タイムラプス） | https://mixkit.co/free-stock-video/seoul-city-time-lapse-at-night-30126/ | **Restricted License（個人利用のみ・要差し替え）** |
| 4 | デスクトップを見る人物 | https://mixkit.co/free-stock-video/intensely-focused-young-man-working-on-a-computer-48503/ | **Restricted License（個人利用のみ・要差し替え）** |
| 5 | ニューヨークの夜景 | https://mixkit.co/free-stock-video/new-york-buildings-at-night-pan-shot-4330/ | Free License（商用可） |
| 6 | PC 画面に向かう人物（肩越し） | https://mixkit.co/free-stock-video/computer-hacker-logging-a-website-with-code-47321/ | **Restricted License（個人利用のみ・要差し替え）** |
| 7 | シンガポールの夜景（マリーナベイ） | https://mixkit.co/free-stock-video/singapore-cityscape-and-harbor-at-night-30998/ | **Restricted License（個人利用のみ・要差し替え）** |

## カット 8〜9: 自作（権利は本プロジェクト）

- カット 8「英語表記のアップデート画面」: ffmpeg の drawtext/drawbox で生成
- カット 9「CreatorYard ロゴ」: ffmpeg の drawtext で生成
  （フォント: DejaVu Sans Bold — Bitstream Vera 系の自由ライセンス）

## 加工内容

各カット約 3.75 秒へトリミング → 0.8 秒のクロスフェードで連結 →
先頭 0.4 秒フェードイン・末尾 0.4 秒フェードアウト（ループの継ぎ目対策）→
1280×720・H.264（mp4）/ VP9（webm）・音声トラックなしで書き出し。
poster は完成動画の 1.2 秒地点の静止画。

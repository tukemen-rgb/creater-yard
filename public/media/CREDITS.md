# 背景動画の素材と権利（Issue #12 の要求による記録）

`hero.mp4` / `hero.webm`（27 秒・9 カット・無音）と `hero-poster.jpg` は
以下の素材から 2026-08-14 に制作した。

## 権利確認の経緯

- 初版はカット 1〜7 をすべて Mixkit とし、サイト共通の Free License を
  前提にしていた。**gdp の再確認で、うち 4 本（旧カット 3・4・6・7）の
  配布ページが Restricted License（個人利用のみ）だと判明**
- Claude が 4 本すべてのページを独立に再取得して追認し、**商用利用可の
  素材へ差し替えた**（Mixkit の Seoul/Singapore 系は全て Restricted
  だったため、都市 2 本は Pexels から調達）
- **全 9 カットの配布ページを 1 本ずつ確認し直した**のが下の表。
  以後、素材を差し替えるときは必ずページ単位でライセンス表示を確認し、
  この表と `RIGHTS_APPROVED` を更新すること

## カット一覧（各配布ページのライセンス表示・2026-08-14 確認）

| カット | 内容 | 配布元 | ページ表示 |
| --- | --- | --- | --- |
| 1 | 東京の夜景（レインボーブリッジ） | https://mixkit.co/free-stock-video/city-of-tokyo-at-night-4383/ | Free License（商用可） |
| 2 | PC を操作する手元 | https://mixkit.co/free-stock-video/close-up-shot-of-a-person-typing-on-a-laptop-1808/ | Free License（商用可） |
| 3 | 韓国・ソウルの夜景（漢江・タイムラプス） | https://www.pexels.com/video/vibrant-night-cityscape-with-traffic-timelapse-38035115/ （作者: Jueon Kim。タグに Seoul / South Korea） | Pexels license（Free to use・商用可） |
| 4 | 机上の PC に向かう人物 | https://mixkit.co/free-stock-video/engineer-working-on-his-computers-in-his-workshop-29990/ | Free License（商用可） |
| 5 | ニューヨークの夜景 | https://mixkit.co/free-stock-video/new-york-buildings-at-night-pan-shot-4330/ | Free License（商用可） |
| 6 | PC 画面と向き合う人物（コードの画面） | https://mixkit.co/free-stock-video/software-developer-working-while-drinks-coffee-1730/ | Free License（商用可） |
| 7 | シンガポールの夜景（マリーナベイ） | https://www.pexels.com/video/lights-display-on-the-marina-bay-sands-at-night-5138460/ （作者: Pjiong） | Pexels license（Free to use・商用可） |

- Mixkit Free License: https://mixkit.co/license/#videoFree
  （商用利用可・改変可・クレジット表記不要）
- Pexels license: https://www.pexels.com/license/
  （商用利用可・改変可・クレジット表記不要）

## カット 8〜9: 自作（権利は本プロジェクト）

- カット 8「英語表記のアップデート画面」: ffmpeg の drawtext/drawbox で生成
- カット 9「CreatorYard ロゴ」: ffmpeg の drawtext で生成
  （フォント: DejaVu Sans Bold — Bitstream Vera 系の自由ライセンス）

## 加工内容

各カット約 3.75 秒へトリミング → 0.8 秒のクロスフェードで連結 →
先頭 0.4 秒フェードイン・末尾 0.4 秒フェードアウト（ループの継ぎ目対策）→
1280×720・H.264（mp4）/ VP9（webm）・音声トラックなしで書き出し。
poster は完成動画の 1.2 秒地点の静止画。

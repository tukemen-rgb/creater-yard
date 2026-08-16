# 背景動画の素材と権利（Issue #12 の要求による記録）

`hero.mp4` / `hero.webm`（27 秒・9 カット・無音）と `hero-poster.jpg` は
以下の素材から 2026-08-14 に制作し、**2026-08-16 に 1920×1080 で作り直した**
（社長指摘: 全幅表示にしたら映像が荒い）。**素材と権利は変えていない** ——
下の表と同じ配布ページの、より高い解像度の書き出しを使っている。

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
- **2026-08-16 に 2 カットとも 1920×1080 で作り直した**（内容は同じ）

## 加工内容

各カット約 3.75 秒へトリミング → 0.8 秒のクロスフェードで連結 →
**1920×1080**・H.264（mp4・CRF 26 / 上限 3 Mbps）/ VP9（webm・CRF 42）・
音声トラックなしで書き出し。poster は完成動画の 1.2 秒地点の静止画。

**両端に黒フェードは入れない。** ループの継ぎ目で画面が黒く沈むのを避ける
ため（Issue #12 の「黒画面を出さない」）。

### 解像度を上げたときの容量（2026-08-16）

| | 前（1280×720） | 後（1920×1080） |
| --- | --- | --- |
| mp4 | 3.4 MB / 1.0 Mbps | **7.0 MB / 2.0 Mbps** |
| webm | 3.2 MB | **5.7 MB** |

画素は 2.25 倍、ビットレートは約 2 倍。**容量も約 2 倍になる**ので、
これ以上上げるなら「スマホには小さい版を配る」仕組みが先に要る。

**webm は mp4 より小さく焼くこと。**`<source>` が webm → mp4 の順なので、
VP9 を解せる browser（大多数）は webm を掴む。**先に並べたほうが大きいと、
多くの利用者だけが黙って重いファイルを取る。**初回の焼き直しで VP9 の CRF を
H.264 と釣り合うと見なして実際に破った（webm 7.9 MB > mp4 7.0 MB）ので、
いまは `server/home-hero.test.mjs` の試験が両者の大小を見張っている。

**取得のタイミング**: 動きを減らす設定の人は video 要素自体を作らないので
**取りに行かない**。そうでない人は `autoPlay muted` なので、**読み込み直後に
再生が始まり、そのまま 27 秒ぶんを取りに行く**（`preload="metadata"` は
再生前の先読みを抑えるだけで、再生が始まれば効かない）。

# 背景動画の素材と権利（Issue #12 の要求による記録）

`hero.mp4` / `hero.webm`（27 秒・9 カット・無音）と `hero-poster.jpg` は
以下の素材から 2026-08-14 に制作した。

## カット 1〜7: Mixkit のフリー素材（取得日 2026-08-14）

ライセンス: **Mixkit Stock Video Free License**
（https://mixkit.co/license/#videoFree）
— 商用利用可・改変可・クレジット表記不要。再配布制限は「素材単体の
再配布」に対するもので、編集して映像作品に組み込む本利用は許可範囲。

| カット | 内容 | 出所 |
| --- | --- | --- |
| 1 | 東京の夜景（レインボーブリッジ） | https://mixkit.co/free-stock-video/city-of-tokyo-at-night-4383/ |
| 2 | PC を操作する手元 | https://mixkit.co/free-stock-video/close-up-shot-of-a-person-typing-on-a-laptop-1808/ |
| 3 | 韓国・ソウルの夜景（タイムラプス） | https://mixkit.co/free-stock-video/seoul-city-time-lapse-at-night-30126/ |
| 4 | デスクトップを見る人物 | https://mixkit.co/free-stock-video/intensely-focused-young-man-working-on-a-computer-48503/ |
| 5 | ニューヨークの夜景 | https://mixkit.co/free-stock-video/new-york-buildings-at-night-pan-shot-4330/ |
| 6 | PC 画面に向かう人物（肩越し） | https://mixkit.co/free-stock-video/computer-hacker-logging-a-website-with-code-47321/ |
| 7 | シンガポールの夜景（マリーナベイ） | https://mixkit.co/free-stock-video/singapore-cityscape-and-harbor-at-night-30998/ |

## カット 8〜9: 自作（権利は本プロジェクト）

- カット 8「英語表記のアップデート画面」: ffmpeg の drawtext/drawbox で生成
- カット 9「CreatorYard ロゴ」: ffmpeg の drawtext で生成
  （フォント: DejaVu Sans Bold — Bitstream Vera 系の自由ライセンス）

## 加工内容

各カット約 3.75 秒へトリミング → 0.8 秒のクロスフェードで連結 →
先頭 0.4 秒フェードイン・末尾 0.4 秒フェードアウト（ループの継ぎ目対策）→
1280×720・H.264（mp4）/ VP9（webm）・音声トラックなしで書き出し。
poster は完成動画の 1.2 秒地点の静止画。

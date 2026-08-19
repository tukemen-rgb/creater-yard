import { MAX_SAVED_STORIES } from './saved-stories'

/**
 * **この製品が、あなたの端末に残すもの。**
 *
 * `/data-policy/` はサーバー側に持つものだけを書いていて、**端末に残るものを
 * 1 つも書いていなかった**（2026-08-20 に①が数えた。提案 U-12）。
 * あの面は自分の註釈でこう決めている:
 *
 * > ここに書いたことは実装の事実と一致させる（**書くだけの約束にしない**）
 *
 * **だから一覧をここに置き、画面はここから描く。**文言を画面に直書きすると、
 * 新しい鍵を足した人が画面を直さずに済んでしまう。
 * `server/device-storage.test.mjs` が、**実装が実際に使っている鍵の集合**と
 * この表を突き合わせる。
 *
 * **鍵の値は変えない。**変えると、いま端末に残っている「あとで読む」の一覧と
 * ログイン状態が読めなくなる（使っている人が黙って締め出される）。
 * 名前の付け方が 2 通りある（`cy-` と `creatoryard:`）のは歴史的な理由で、
 * **揃えない**のはそのためである。
 */
export type DeviceStorageItem = {
  /** 実際の鍵。**画面にも出す**（開発者ツールで誰でも見られるものを隠さない）。 */
  key: string
  /** 何が入るか。 */
  what: string
  /** いつ消えるか。**実装から確かめた事実だけ**を書く。 */
  clearedBy: string
}

export const DEVICE_STORAGE: readonly DeviceStorageItem[] = [
  {
    key: 'cy-token',
    what: 'ログインの合い言葉',
    clearedBy: 'ログアウトしたとき',
  },
  {
    key: 'cy-handle',
    what: 'あなたのハンドル',
    clearedBy: 'ログアウトしたとき',
  },
  {
    key: 'cy-saved-story-ids',
    what: `「あとで読む」に入れた Story の番号（最大 ${MAX_SAVED_STORIES} 本）`,
    clearedBy: '自分で外したとき',
  },
  {
    key: 'creatoryard:story-interview-draft',
    what: 'ヒアリングで書いた題・本文・つまずき',
    clearedBy: '書く画面に引き継いだとき（引き継がなければ残ります）',
  },
  {
    key: 'creatoryard:story-interview-progress',
    what: 'ヒアリングの答えと、どこまで進んだか',
    clearedBy: '最後まで進めたときと、やり直したとき',
  },
] as const

/**
 * **上の全部に共通して効くもの。**
 *
 * `localStorage` そのものには期限が無い（MDN・事例 82）。**しかし Safari は、
 * サイト越えトラッキング防止が入っているとき、7 日そのサイトに来なかった
 * 訪問者の「スクリプトが作ったデータ」を消す**（MDN・事例 83）:
 *
 * > `If an origin has no user interaction, such as click or tap, in the last
 * > seven days of browser use, its data created from script will be deleted.`
 *
 * **この製品は cookie を使っていないので、上の 5 つが全部その対象になる。**
 * 「自分で外したとき」だけを書くと、**7 日で消えることを知らない人は
 * 「消えないもの」と読む。**だから並べて書く。
 *
 * 数（7）は一次資料から**書き写している**。MDN の記述が変わったら、
 * ここも直すこと。
 */
export const DEVICE_STORAGE_EVICTION =
  'Safari（iPhone を含む）では、7 日このサイトに来ないと、上のすべてが消えます。' +
  'ログインが切れ、「あとで読む」が空になり、ヒアリングの書きかけも無くなります。'

/** 共有の端末で書く人へ。**脅さない。「こうなります」だけ書く。** */
export const DEVICE_STORAGE_SHARED_DEVICE =
  '共有の端末で書くときは、席を立つ前にログアウトし、' +
  'ブラウザの保存領域（サイトデータ）を消してください。'

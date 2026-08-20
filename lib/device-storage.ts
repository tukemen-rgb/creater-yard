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
/**
 * 端末に置く「あとで読む」の上限。**緩めるのは人の判断**（CLAUDE.md）。
 * **置き場をここにしたのは、これが端末に置く数の上限だから**であり、
 * `lib/saved-stories.ts` からも再輸出して従来どおり使える
 * （あちらから輸入すると、この一覧との間で輪ができる）。
 */
export const MAX_SAVED_STORIES = 50

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
    clearedBy: '書く画面に引き継いだときと、退会したとき（どちらも無ければ残ります）',
  },
  {
    key: 'creatoryard:story-interview-progress',
    what: 'ヒアリングの答えと、どこまで進んだか',
    clearedBy: '最後まで進めたとき・やり直したとき・退会したとき',
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

/**
 * ここから下は**触り方**。
 *
 * **`localStorage` は「保存できない」ではなく「触っただけで落ちる」**
 * （MDN・事例 84）:
 *
 * > `SecurityError … The request violates a policy decision. For example, the
 * > user has configured the browsers to prevent the page from persisting data.`
 * > `Note that if the user blocks cookies, browsers will probably interpret this
 * > as an instruction to prevent the page from persisting data.`
 *
 * 2026-08-20 に数えたら、`localStorage` を触るのは **3 ファイル・11 か所**で、
 * **囲いは関数ごとにまちまち・穴は 6 か所**だった。しかも**囲っていない読み取りを
 * 呼ぶのは全ページのヘッダー**（`components/nav-auth.tsx`）で、
 * **保存を拒否している人には全ページで落ちうる**形だった。
 *
 * **関数ごとに `try` を足すやり方は採らない**（また次に足す人が忘れる）。
 * **直に触るのはこのファイルだけ**にして、`server/device-storage.test.mjs` が
 * それを縛る。
 */
/**
 * **端末へ残せたか。**
 *
 * この型を返す関数は、**呼び出し元が必ず受け取る**
 * （`server/device-storage.test.mjs` が縛る）。
 * `boolean` の別名にしているのは**印を付けるため**であって、
 * 型として強くするためではない —— 強くすると既存の呼び出しが壊れ、
 * **直すために型を外す**という逆向きの力が働く。
 *
 * **名前の一覧を試験に書かない**ための仕掛けでもある。一覧は足し忘れると
 * その関数が最初から網の外になる（`cy-` の鍵 3 つで実際に踏んだ）。
 */
export type Kept = boolean

export function readValue(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * **書けたら true。**
 *
 * `catch` で黙って捨てると「**保存したつもりで保存されていない**」が生まれる。
 * 呼び出し側が知れるようにしておき、**言うかどうかはその画面が決める**。
 */
export function writeValue(key: string, value: string): Kept {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** 消せなかったときは黙ってよい —— 消せない置き場に、その値はもう無い。 */
export function removeValue(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 触れないなら、そもそも書けていない
  }
}

/**
 * ログインは成立したのに、この端末に残せなかったときに出す 1 行。
 *
 * **画面ごとに書かない。**同じ状況に同じ言葉で答えるため、ここに置く
 * （`server/device-storage.test.mjs` が、呼ぶ面がこれを使っていることを見る）。
 */
export const DEVICE_STORAGE_WRITE_FAILED =
  'この端末には、ログイン状態を保存できない設定になっています。' +
  'ブラウザがサイトデータを拒否していないか確かめてください。'

/**
 * ヒアリングの終わりで、書きかけを端末に残せなかったときの 1 行（U-15）。
 *
 * **登録へ送らない。**送れば画面が変わり、書いた 4 行は本当に消える。
 * 送らなければ、少なくとも本人の画面には残っている。
 */
export const DEVICE_STORAGE_DRAFT_KEPT_ON_SCREEN =
  'この端末には書きかけを保存できませんでした。この画面の内容は残っています。' +
  '登録するといまの内容は引き継がれないので、先にどこかへ控えてください。'

/** 「あとで読む」を押したのに、端末へ残せなかったときの 1 行（U-15）。 */
export const DEVICE_STORAGE_SAVE_STORY_FAILED =
  'この端末には保存できませんでした。ブラウザがサイトデータを拒否していないか確かめてください。'

/**
 * **書き始める入口。**
 *
 * トップの「書き始める」と、Story の面の招待（U-14）は**同じ入口**でなければ
 * ならない。片方だけ変えると、**入口が 2 通りになったことに誰も気づかない**
 * （白紙を出さない側と、出す側に分かれてしまう）。
 *
 * `?mode=interview` は `app/write/page.common.tsx` が見ている
 * （`params.get('mode') === 'interview'`）。**白紙の前で止まらないための入口**で、
 * 4 つの問いから始まる。
 */
export const WRITE_START_HREF = '/write/?mode=interview'

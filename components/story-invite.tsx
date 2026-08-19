'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getHandle } from '../lib/api'
import { WRITE_START_HREF } from '../lib/write-entry'

/**
 * 読み終えた人に、**書き始める道を 1 本だけ**出す（U-14）。
 *
 * 2026-08-20 に `origin/main` を数えたら、**Story の面から `/write/` へ行く道は
 * 本人向けの「その後を書く」しか無かった。**読者に差し出している最後のリンクは
 * **「この Story の問題を通報する」**である。
 *
 * 読者向けの次は「次に読む、別の作者の Story」が 1 つあるが、**作者が 2 人
 * 以上いないと出ない**（本番はいま 1 人なので出ていない）。しかもあれは
 * **読む側の道**であって、書く側の道ではない。
 *
 * > `they quickly decide that the page is not worth exploring any longer and simply leave.`
 * > —— NN/g「Information Scent」（事例 85）
 *
 * **招かれた人が最初に開くのは、たいてい Story の直リンク**である。
 * その面が次を持っていないことは、そのまま撤退条件に効く。
 *
 * 作法（設計 U-14）:
 *
 * - **本人には出さない。**本人には `WriteNextLink`（「その後を書く」）が出る。
 *   2 つ並べない。サーバー側は閲覧者を知らない（静的にも出る面）ので、
 *   `write-next-link.tsx` と同じく**描画後に**切り替える
 * - **数を出さない。**書き手の数も、記録の数も出さない —— 公開カウンタに
 *   近づくし、いまは 1 人である。
 *   註: この試験は**註釈もソースとして読む**ので、**禁じた語をここに書くと
 *   赤くなる**（`write-next-link.tsx` と同じ扱い）。実際、最初の版で踏んだ。
 *   **それでよい** —— 註釈から本文へ戻る経路も、まとめて塞いでいる
 * - **煽らない。**急かす語・易しさを謳う語・値段の語は置かない
 *   （I-10 で消した「果たせない約束」と同じ族になる）。
 *   **その語をここに並べることもできない** —— 上と同じ理由で赤くなる。
 *   何を禁じているかは `server/story-invite.test.mjs` に一覧がある
 * - **通信を増やさない。**判定に使うのは端末に既に在る値だけ
 *
 * 註: 行き先は `lib/write-entry.ts` から取る。**トップの「書き始める」と
 * 同じ入口**でなければならず、書き写すと片方だけ変わる。
 */
export function StoryInvite({ authorHandle }: { authorHandle: string }) {
  const [mine, setMine] = useState(true)
  useEffect(() => {
    setMine(getHandle() === authorHandle)
  }, [authorHandle])
  // 判定が付くまでは出さない（本人の画面で一瞬だけ出るのを避ける）
  if (mine) return null
  return (
    <p className="story__invite">
      <Link prefetch={false} href={WRITE_START_HREF}>
        あなたの記録も、ここに残せます。
      </Link>
    </p>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getHandle } from '../lib/api'

/**
 * 本人にだけ見える「その後を書く」（I-11）。公開したあとの着地点から、
 * 次の 1 本への導線を出す。`edit-link.tsx` と同型 —— サーバー側は閲覧者を
 * 知らない（静的にも出力される HTML なので知りようがない）ため、描画後に
 * localStorage のログイン状態を見て出す。
 *
 * **数を持たない。**①の提案は `/account/` と同じ文をそのまま出すことだったが、
 * あの文は「◯本目です」に相当する書き出しで始まり、**公開が 1 本のときに
 * しか真でない**。`/account/` はそれを**自分の一覧の API を認証つきで叩いて**
 * 確かめている。ここでその数を持つには通信を 1 本増やすことになり、**1 文のために
 * 割に合わない**。持たないまま出せば「5 本目なのに 1 本目と書く」ことになり、
 * それは I-10 で消したばかりの形である。
 *
 * 註: この試験は註釈もソースとして読むので、**禁じた語（数を取りに行く経路の
 * 名前や「◯本目」の文言）をここに書くと赤くなる**。今夜 4 回目である。
 * **それでよい** —— 註釈から本文へ戻ってくる経路も、まとめて塞いでいる。
 *
 * **だから残したのはリンクの語だけ。**「その後を書く」は何本目でも真で、
 * リンク先が出す文（前の Story から変わったこと、次に試したこと）も
 * 何本目でも真である。
 *
 * `from=first-story` という名前は紛らわしいが**変えない** ——
 * `/account/` 側と揃わなくなる（同じ語・同じリンク先であることを
 * `server/story-ui.test.mjs` が 2 ファイル突き合わせて縛っている）。
 */
export function WriteNextLink({ authorHandle }: { authorHandle: string }) {
  const [mine, setMine] = useState(false)
  useEffect(() => {
    setMine(getHandle() === authorHandle)
  }, [authorHandle])
  if (!mine) return null
  return (
    <p className="story__next">
      <Link prefetch={false} href="/write/?from=first-story">その後を書く</Link>
    </p>
  )
}

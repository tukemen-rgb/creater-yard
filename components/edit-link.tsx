'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getHandle } from '../lib/api'

/**
 * 本人にだけ見える「編集する」。サーバー側は閲覧者を知らない（静的にも
 * 出力される HTML なので知りようがない）ため、描画後に localStorage の
 * ログイン状態を見て出す。
 */
export function EditLink({ id, authorHandle }: { id: string; authorHandle: string }) {
  const [mine, setMine] = useState(false)
  useEffect(() => {
    setMine(getHandle() === authorHandle)
  }, [authorHandle])
  if (!mine) return null
  return (
    <>
      {' ・ '}
      <Link prefetch={false} href={`/write/?id=${id}`}>編集する</Link>
    </>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getHandle } from '../lib/api'

/** 本人にだけ見える「編集する」（edit-link.tsx の出品版）。 */
export function OfferEditLink({ id, authorHandle }: { id: string; authorHandle: string }) {
  const [mine, setMine] = useState(false)
  useEffect(() => {
    setMine(getHandle() === authorHandle)
  }, [authorHandle])
  if (!mine) return null
  return (
    <>
      {' ・ '}
      <Link prefetch={false} href={`/sell/?id=${id}`}>編集する</Link>
    </>
  )
}

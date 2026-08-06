'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getHandle } from '../lib/api'

/**
 * ヘッダーのログイン状態。静的書き出しのためサーバーでは判定できず、
 * 描画後に localStorage を見て切り替える（それまではログインだけ出す）。
 */
export function NavAuth() {
  const [handle, setHandle] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setHandle(getHandle())
    setReady(true)
  }, [])

  if (!ready) return null
  if (!handle) {
    return (
      <Link prefetch={false} href="/login/">
        ログイン
      </Link>
    )
  }
  return (
    <>
      <Link prefetch={false} href="/write/" className="site-nav__primary">
        書く
      </Link>
      <Link prefetch={false} href="/account/">{handle}</Link>
    </>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { savedStoryIds, toggleSavedStory } from '../lib/saved-stories'

export function SaveStory({ id }: { id: string }) {
  const [saved, setSaved] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSaved(savedStoryIds().includes(id))
    setReady(true)
  }, [id])

  if (!ready) return null

  return (
    <p className="notice">
      <button type="button" className="linklike" onClick={() => setSaved(toggleSavedStory(id))}>
        {saved ? '保存を解除する' : 'あとで読むために、このブラウザへ保存'}
      </button>
      {saved && (
        <>
          {' ・ '}
          <Link prefetch={false} href="/saved/">保存した Story を見る</Link>
        </>
      )}
      <br />
      <small>保存するのは Story ID だけです。CreatorYard のサーバーには送信しません。</small>
    </p>
  )
}

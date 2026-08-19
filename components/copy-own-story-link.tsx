'use client'

import { useEffect, useState } from 'react'

import { getHandle } from '../lib/api'

/**
 * 公開した本人だけに出す、正規 URL のコピー導線。
 *
 * SNS 別のリンクや Web Share API は使わない。共有先を CreatorYard が
 * 決めたり記録したりせず、本人が貼る場所と文面を選べる状態を保つ。
 */
export function CopyOwnStoryLink({ id, authorHandle }: { id: string; authorHandle: string }) {
  const [isAuthor, setIsAuthor] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setIsAuthor(getHandle() === authorHandle)
  }, [authorHandle])

  if (!isAuthor) return null

  const copy = async () => {
    const url = `${window.location.origin}/story/${encodeURIComponent(id)}/`
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(url)
      setMessage('URLをコピーしました。')
    } catch {
      window.prompt('このURLをコピーしてください。', url)
      setMessage('自動でコピーできない場合は、表示されたURLをコピーしてください。')
    }
  }

  return (
    <p className="notice">
      <button type="button" className="linklike" onClick={copy}>
        この Story の URL をコピー
      </button>
      {message && <span role="status"> ・ {message}</span>}
      <br />
      <small>共有先と文面は自分で選べます。CreatorYard は共有先を記録しません。</small>
    </p>
  )
}

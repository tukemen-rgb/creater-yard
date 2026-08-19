'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { DEVICE_STORAGE_SAVE_STORY_FAILED } from '../lib/device-storage'
import { savedLimitNotice, savedStoryIds, toggleSavedStory } from '../lib/saved-stories'

export function SaveStory({ id }: { id: string }) {
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [ready, setReady] = useState(false)
  /** 端末に残せなかったこと。押すたびに取り直す（U-15）。 */
  const [failed, setFailed] = useState(false)

  /** 端末の中身を見て、いまの状態を取り直す。押したあとも同じ道を通る。 */
  const sync = (ids: string[]) => {
    setSaved(ids.includes(id))
    setSavedCount(ids.length)
  }

  useEffect(() => {
    sync(savedStoryIds())
    setReady(true)
    // sync は毎描画で作り直されるが、中でしているのは状態を置くことだけ。
    // 依存に足すと毎描画で読み直すことになるので入れない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!ready) return null

  // いっぱいのときだけ出る。文言も上限も lib 側から取る（画面に数を書かない）。
  const limitNotice = savedLimitNotice(savedCount, saved)

  return (
    <p className="notice">
      <button
        type="button"
        className="linklike"
        onClick={() => {
          // 残せなかったときは、読み直した表示が勝手に元へ戻る。
          // **戻ったことだけでは理由が分からない**ので、そこに 1 行出す。
          const { kept } = toggleSavedStory(id)
          setFailed(!kept)
          sync(savedStoryIds())
        }}
      >
        {saved ? '保存を解除する' : 'あとで読むために、このブラウザへ保存'}
      </button>
      {failed && (
        <>
          <br />
          <small role="alert">{DEVICE_STORAGE_SAVE_STORY_FAILED}</small>
        </>
      )}
      {limitNotice && (
        <>
          <br />
          <small>{limitNotice}</small>
        </>
      )}
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

'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  hasWebm: boolean
}

/**
 * 装飾用の背景動画。初期描画では poster だけを表示し、利用者が動きを
 * 減らす設定にしていないと確認できた場合だけ video を生成する。
 * これにより reduced-motion 時は、CSS で隠すだけでなく取得と自動再生を避ける。
 */
export default function HeroVideo({ hasWebm }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [canAnimate, setCanAnimate] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => {
      setCanAnimate(!media.matches)
      setPaused(false)
    }

    syncPreference()
    media.addEventListener('change', syncPreference)
    return () => media.removeEventListener('change', syncPreference)
  }, [])

  if (!canAnimate) return null

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      await video.play()
    } else {
      video.pause()
    }
  }

  return (
    <>
      <video
        ref={videoRef}
        className="hero__video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/hero-poster.jpg"
        aria-hidden="true"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      >
        {hasWebm && <source src="/media/hero.webm" type="video/webm" />}
        <source src="/media/hero.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        className="hero__motion-control"
        onClick={togglePlayback}
        aria-label={paused ? '背景動画を再生' : '背景動画を一時停止'}
      >
        {paused ? '再生' : '一時停止'}
      </button>
    </>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

type RecognitionResult = {
  0?: { transcript?: string }
}

type RecognitionEvent = {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}

type RecognitionErrorEvent = {
  error: string
}

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => Recognition

function recognitionConstructor() {
  const voiceWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition
}

function errorMessage(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'マイクの使用が許可されていません。ブラウザの設定を確認してください。'
  }
  if (error === 'no-speech') return '音声を聞き取れませんでした。もう一度お試しください。'
  return '音声入力を開始できませんでした。もう一度お試しください。'
}

export function VoiceInput({
  label,
  disabled = false,
  onTranscript,
}: {
  label: string
  disabled?: boolean
  onTranscript: (text: string) => void
}) {
  const recognitionRef = useRef<Recognition | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setSupported(Boolean(recognitionConstructor()))
    return () => recognitionRef.current?.abort()
  }, [])

  if (supported === null) return null
  if (!supported) {
    return <span className="form__hint">このブラウザでは音声入力を利用できません。</span>
  }

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const RecognitionApi = recognitionConstructor()
    if (!RecognitionApi) return

    const recognition = new RecognitionApi()
    recognition.lang = 'ja-JP'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcripts: string[] = []
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript?.trim()
        if (transcript) transcripts.push(transcript)
      }
      if (transcripts.length > 0) {
        onTranscript(transcripts.join(''))
        setMessage('音声を入力しました。')
      }
    }
    recognition.onerror = (event) => setMessage(errorMessage(event.error))
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }

    recognitionRef.current = recognition
    setMessage('')
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
      setListening(false)
      setMessage('音声入力を開始できませんでした。もう一度お試しください。')
    }
  }

  return (
    <span className="voice-input">
      <button
        type="button"
        className="button button--ghost voice-input__button"
        aria-pressed={listening}
        aria-label={label}
        disabled={disabled}
        onClick={toggle}
      >
        {listening ? '音声入力を止める' : '音声で入力'}
      </button>
      {message && <span className="voice-input__status" role="status">{message}</span>}
    </span>
  )
}

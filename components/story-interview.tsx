'use client'

import { useEffect, useRef, useState } from 'react'

import {
  appendInterviewTranscript,
  buildInterviewDraft,
  clearInterviewProgress,
  INTERVIEW_QUESTIONS,
  loadInterviewProgress,
  saveInterviewProgress,
  type InterviewDraft,
} from '../lib/story-interview'
import { VoiceInput } from './voice-input'

export function StoryInterview({
  onComplete,
}: {
  onComplete: (draft: InterviewDraft) => void | Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(() => INTERVIEW_QUESTIONS.map(() => ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progressReady, setProgressReady] = useState(false)
  const [restored, setRestored] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const advanceLockRef = useRef(false)
  const question = INTERVIEW_QUESTIONS[step]
  const answer = answers[step]

  useEffect(() => {
    const saved = loadInterviewProgress()
    if (saved) {
      setAnswers(saved.answers)
      setStep(saved.step)
      setRestored(true)
    }
    setProgressReady(true)
  }, [])

  useEffect(() => {
    if (!progressReady) return
    if (step > 0 || answers.some((savedAnswer) => savedAnswer.trim())) {
      saveInterviewProgress({ answers, step })
    } else {
      clearInterviewProgress()
    }
  }, [answers, progressReady, step])

  useEffect(() => {
    advanceLockRef.current = false
  }, [step])

  const updateAnswer = (value: string) => {
    setAnswers((current) => current.map((item, index) => (index === step ? value.slice(0, 1200) : item)))
  }

  const restart = () => {
    if (!window.confirm('保存した回答を消して、最初から始めますか？')) return
    clearInterviewProgress()
    setAnswers(INTERVIEW_QUESTIONS.map(() => ''))
    setStep(0)
    setRestored(false)
    setError('')
  }

  const advance = async (spokenAnswer?: string) => {
    if (advanceLockRef.current) return
    advanceLockRef.current = true
    const finalAnswers = answers.map((item, index) => (
      index === step ? (spokenAnswer ?? item).trim() : item.trim()
    ))
    if (!finalAnswers[step]) {
      setError('回答を入力してください。')
      advanceLockRef.current = false
      return
    }
    setAnswers(finalAnswers)
    setError('')
    if (step < INTERVIEW_QUESTIONS.length - 1) {
      setStep((current) => current + 1)
      return
    }
    setBusy(true)
    try {
      await onComplete(buildInterviewDraft(finalAnswers))
      clearInterviewProgress()
    } catch {
      setError('回答を引き継げませんでした。この画面のまま、もう一度お試しください。')
      setBusy(false)
      advanceLockRef.current = false
    }
  }

  return (
    <section className="interview" aria-labelledby="interview-title">
      <p className="interview__eyebrow">Story ヒアリング</p>
      <h1 id="interview-title">話すだけで、Story の下書きに。</h1>
      <p className="page__lede">
        4 つの質問に答えると、端末内で投稿フォームへ自動で整理します。
        CreatorYard 独自の AI/API へ回答を送信しません。
        {/* 音声の行き先は VoiceInput が各ボタンのそばで言う（設計 U-11）。
            ここで繰り返すと、同じことを 2 度言ううえに、**片方だけ古くなる** */}
      </p>
      <p className="interview__progress" aria-live="polite">
        質問 {step + 1} / {INTERVIEW_QUESTIONS.length}
      </p>
      <div className="interview__saved">
        <p role="status">
          {restored ? '保存した続きから再開しました。' : '回答は質問ごとに、この端末へ自動保存されます。'}
        </p>
        {restored && (
          <button type="button" className="linklike" disabled={busy || voiceListening} onClick={restart}>
            最初からやり直す
          </button>
        )}
      </div>
      <div className="interview__card">
        <h2>{question.label}</h2>
        <p className="form__hint">{question.hint}</p>
        <label className="form__field">
          回答
          <textarea
            autoFocus
            disabled={voiceListening || busy}
            value={answer}
            rows={6}
            maxLength={1200}
            placeholder={question.placeholder}
            onChange={(event) => updateAnswer(event.target.value)}
          />
        </label>
        <VoiceInput
          label={`${question.label}への回答を音声で入力`}
          disabled={busy}
          onListeningChange={setVoiceListening}
          onTranscript={(transcript) => {
            const combinedAnswer = appendInterviewTranscript(answer, transcript)
            updateAnswer(combinedAnswer)
            void advance(combinedAnswer)
          }}
        />
        <p className="interview__voice-note" role={voiceListening ? 'status' : undefined}>
          {voiceListening
            ? '聞き取り中です。完了すると自動で次の質問へ進みます。'
            : '音声は聞き取り後、自動で次の質問へ進みます。'}
        </p>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <div className="interview__actions">
          {step > 0 && (
            <button
              type="button"
              className="button button--ghost"
              disabled={busy || voiceListening}
              onClick={() => {
                setError('')
                setStep((current) => current - 1)
              }}
            >
              前の質問
            </button>
          )}
          <button
            type="button"
            className="button"
            disabled={busy || voiceListening}
            onClick={() => void advance()}
          >
            {busy
              ? '下書きを準備中…'
              : step === INTERVIEW_QUESTIONS.length - 1
                ? 'Story の下書きをつくる'
                : '回答して次へ'}
          </button>
        </div>
      </div>
    </section>
  )
}

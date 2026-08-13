'use client'

import { useEffect, useState } from 'react'

import {
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

  const updateAnswer = (value: string) => {
    setAnswers((current) => current.map((item, index) => (index === step ? value.slice(0, 1200) : item)))
  }

  const advance = async (spokenAnswer?: string) => {
    const finalAnswers = answers.map((item, index) => (
      index === step ? (spokenAnswer ?? item).trim() : item.trim()
    ))
    if (!finalAnswers[step]) {
      setError('回答を入力してください。')
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
    }
  }

  return (
    <section className="interview" aria-labelledby="interview-title">
      <p className="interview__eyebrow">AIヒアリング</p>
      <h1 id="interview-title">話すだけで、Storyの下書きに。</h1>
      <p className="page__lede">
        4つの質問に答えると、投稿フォームへ自動で整理します。API接続前も基本質問で利用できます。
      </p>
      <p className="interview__progress" aria-live="polite">
        質問 {step + 1} / {INTERVIEW_QUESTIONS.length}
      </p>
      <p className="interview__saved" role="status">
        {restored ? '保存した続きから再開しました。' : '回答は質問ごとに、この端末へ自動保存されます。'}
      </p>
      <div className="interview__card">
        <h2>{question.label}</h2>
        <p className="form__hint">{question.hint}</p>
        <label className="form__field">
          回答
          <textarea
            autoFocus
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
          onTranscript={(transcript) => {
            updateAnswer(transcript)
            void advance(transcript)
          }}
        />
        <p className="interview__voice-note">音声は聞き取り後、自動で次の質問へ進みます。</p>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <div className="interview__actions">
          {step > 0 && (
            <button
              type="button"
              className="button button--ghost"
              disabled={busy}
              onClick={() => {
                setError('')
                setStep((current) => current - 1)
              }}
            >
              前の質問
            </button>
          )}
          <button type="button" className="button" disabled={busy} onClick={() => void advance()}>
            {busy
              ? '下書きを準備中…'
              : step === INTERVIEW_QUESTIONS.length - 1
                ? 'Storyの下書きをつくる'
                : '回答して次へ'}
          </button>
        </div>
      </div>
    </section>
  )
}

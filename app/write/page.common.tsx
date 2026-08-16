'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  api,
  ApiError,
  getHandle,
  imageUrl,
  uploadImage,
  type Story,
  type StoryImage,
} from '../../lib/api'
import { SITE_FEED } from '../../lib/og'
import { VoiceInput } from '../../components/voice-input'
import { StoryInterview } from '../../components/story-interview'
import {
  saveInterviewDraft,
  takeInterviewDraft,
  type InterviewDraft,
} from '../../lib/story-interview'

function appendTranscript(current: string, transcript: string, maxLength: number, separator: string) {
  const before = current.trimEnd()
  return `${before}${before ? separator : ''}${transcript}`.slice(0, maxLength)
}

/**
 * Story を書く・直す。?id= があれば編集。
 *
 * ツールとタグはカンマ区切りの 1 行入力にした。専用 UI（補完・候補）は
 * タグが実際に溜まって傾向が見えてから作る（先に凝ると、使われない形に
 * 凝ることになる）。
 */
function WriteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id') ?? ''
  const followsFirstStory = !editId && params.get('from') === 'first-story'
  const startsWithInterview = !editId && params.get('mode') === 'interview'
  const restoresInterview = !editId && params.get('restore') === 'interview'

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tools, setTools] = useState('')
  const [toolTags, setToolTags] = useState('')
  const [topicTags, setTopicTags] = useState('')
  const [hurdleText, setHurdleText] = useState('')
  const [hurdleStatus, setHurdleStatus] = useState<'open' | 'resolved'>('open')
  const [gameUrl, setGameUrl] = useState('')
  const [status, setStatus] = useState<'public' | 'draft'>('public')
  const [image, setImage] = useState<StoryImage | null>(null)
  const [imageAlt, setImageAlt] = useState('')
  const [imageWarnings, setImageWarnings] = useState<string[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState<{ id: string; message: string } | null>(null)
  const [loadedEditId, setLoadedEditId] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const storyOperationLockRef = useRef(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [optionalFieldsOpen, setOptionalFieldsOpen] = useState(false)
  const [interviewActive, setInterviewActive] = useState(startsWithInterview)

  useEffect(() => {
    let active = true
    if (!getHandle() && !startsWithInterview) {
      router.replace('/login/')
      return () => {
        active = false
      }
    }
    if (!editId) {
      return () => {
        active = false
      }
    }
    setLoadedEditId('')
    setLoadError(null)
    api<{ story: Story }>(`/api/stories/${editId}.json`, { auth: true })
      .then(({ story }) => {
        if (!active) return
        if (story.authorHandle !== getHandle()) {
          setLoadError({ id: editId, message: 'この Story を編集できるのは本人だけです。' })
          return
        }
        setTitle(story.title)
        setBody(story.body)
        setTools(story.tools.join(', '))
        setToolTags(story.toolTags.join(', '))
        setTopicTags(story.topicTags.join(', '))
        setHurdleText(story.hurdle?.text ?? '')
        setHurdleStatus(story.hurdle?.status ?? 'open')
        setGameUrl(story.gameUrl)
        setStatus(story.status)
        setImage(story.image)
        setImageAlt(story.imageAlt ?? '')
        setOptionalFieldsOpen(Boolean(
          story.tools.length
          || story.toolTags.length
          || story.topicTags.length
          || story.image
          || story.gameUrl,
        ))
        setLoadedEditId(editId)
      })
      .catch((err: unknown) => {
        if (active) {
          setLoadError({
            id: editId,
            message: err instanceof ApiError ? err.message : '読み込めませんでした。',
          })
        }
      })
    return () => {
      active = false
    }
  }, [editId, router, loadAttempt, startsWithInterview])

  useEffect(() => {
    if (!restoresInterview || !getHandle()) return
    const draft = takeInterviewDraft()
    if (!draft) return
    setTitle(draft.title)
    setBody(draft.body)
    setHurdleText(draft.hurdleText)
    setHasUnsavedChanges(true)
  }, [restoresInterview])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const message = '保存していない内容があります。このページを離れますか？'
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLAnchorElement>('a[href]')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      if (window.confirm(message)) {
        setHasUnsavedChanges(false)
        return
      }
      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    document.addEventListener('click', confirmLinkNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      document.removeEventListener('click', confirmLinkNavigation, true)
    }
  }, [hasUnsavedChanges])

  const splitList = (value: string) =>
    value.split(/[,、，]/).map((item) => item.trim()).filter(Boolean)

  const save = async (saveStatus: 'public' | 'draft') => {
    if (storyOperationLockRef.current) return
    if (imageUploading) {
      setError('画像の確認が終わるまでお待ちください。')
      return
    }
    storyOperationLockRef.current = true
    setBusy(true)
    setError('')
    const payload = {
      title,
      body,
      tools: splitList(tools),
      toolTags: splitList(toolTags),
      topicTags: splitList(topicTags),
      hurdle: hurdleText.trim() ? { text: hurdleText, status: hurdleStatus } : null,
      gameUrl,
      status: saveStatus,
      imageId: image?.id ?? null,
      imageAlt: image ? imageAlt : '',
    }
    try {
      const data = editId
        ? await api<{ story: Story }>(`/api/stories/${editId}`, { method: 'PUT', body: payload, auth: true })
        : await api<{ story: Story }>('/api/stories', { method: 'POST', body: payload, auth: true })
      setHasUnsavedChanges(false)
      router.push(saveStatus === 'public' ? `/story/${data.story.id}/` : '/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存できませんでした。')
      storyOperationLockRef.current = false
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editId || storyOperationLockRef.current) return
    storyOperationLockRef.current = true
    // 消す前に 1 回だけ確かめる。記録は本人のものなので、確認さえ取れば止めない
    if (!window.confirm('この Story を削除します。元に戻せません。よろしいですか？')) {
      storyOperationLockRef.current = false
      return
    }
    setBusy(true)
    try {
      await api<{ ok: boolean }>(`/api/stories/${editId}`, { method: 'DELETE', auth: true })
      setHasUnsavedChanges(false)
      router.push('/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除できませんでした。')
      storyOperationLockRef.current = false
      setBusy(false)
    }
  }

  const finishInterview = async (draft: InterviewDraft) => {
    if (!getHandle()) {
      saveInterviewDraft(draft)
      router.push('/signup/')
      return
    }
    setTitle(draft.title)
    setBody(draft.body)
    setHurdleText(draft.hurdleText)
    setHasUnsavedChanges(true)
    setInterviewActive(false)
  }

  if (editId && loadedEditId !== editId) {
    const currentLoadError = loadError?.id === editId ? loadError.message : ''
    if (!currentLoadError) return <p className="notice">読み込み中…</p>
    return (
      <div className="page page--narrow">
        <div className="notice notice--error" role="alert">
          {currentLoadError}{' '}
          <button type="button" className="button button--ghost" onClick={() => setLoadAttempt((count) => count + 1)}>
            もう一度読み込む
          </button>
        </div>
        <p>
          <Link prefetch={false} href="/account/">← 自分のStory一覧へ</Link>
        </p>
      </div>
    )
  }

  if (interviewActive) {
    return (
      <div className="page page--narrow">
        <StoryInterview onComplete={finishInterview} />
      </div>
    )
  }

  return (
    <div className="page page--narrow">
      <h1>{editId ? 'Story を直す' : 'Story を書く'}</h1>
      <p className="page__lede">
        {followsFirstStory
          ? '前の Story から変わったこと、次に試したこと。それだけで続きの 1 本になります。'
          : '完成していなくていい。今日つまずいたこと、試したこと、それだけで 1 本になります。'}
      </p>
      {error && <p className="notice notice--error">{error}</p>}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save(status)
        }}
      >
        <label className="form__field">
          タイトル
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setHasUnsavedChanges(true)
            }}
            maxLength={80}
            required
          />
        </label>
        <label className="form__field">
          本文
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setHasUnsavedChanges(true)
            }}
            rows={14}
            maxLength={8000}
            placeholder={
              followsFirstStory
                ? '前回から変わったこと、試したこと、まだ残っていること。'
                : '何を作ろうとして、どこでつまずいて、どう抜けたか（抜けられていなくても）。'
            }
          />
          <VoiceInput
            label="本文を音声で入力"
            disabled={busy}
            onTranscript={(transcript) => {
              setBody((current) => appendTranscript(current, transcript, 8000, '\n'))
              setHasUnsavedChanges(true)
            }}
          />
        </label>
        <fieldset className="form__field hurdle-editor">
          <legend>いま悩んでいること・乗り越えたこと（任意）</legend>
          <p className="form__hint">
            具体的に書くと、同じ悩みを持つ人や解決経験のある人が見つけやすくなります。
          </p>
          <textarea
            value={hurdleText}
            onChange={(e) => {
              setHurdleText(e.target.value)
              setHasUnsavedChanges(true)
            }}
            rows={3}
            maxLength={200}
            placeholder="例: スマホで操作すると当たり判定がずれる原因が分からない"
          />
          <VoiceInput
            label="悩みを音声で入力"
            disabled={busy}
            onTranscript={(transcript) => {
              setHurdleText((current) => appendTranscript(current, transcript, 200, ' '))
              setHasUnsavedChanges(true)
            }}
          />
          {hurdleText.trim() && (
            <div className="hurdle-editor__status" role="group" aria-label="つまずきの状態">
              <button
                type="button"
                className={hurdleStatus === 'open' ? 'choice-chip choice-chip--active' : 'choice-chip'}
                aria-pressed={hurdleStatus === 'open'}
                onClick={() => {
                  setHurdleStatus('open')
                  setHasUnsavedChanges(true)
                }}
              >
                まだ悩んでいる
              </button>
              <button
                type="button"
                className={hurdleStatus === 'resolved' ? 'choice-chip choice-chip--resolved' : 'choice-chip'}
                aria-pressed={hurdleStatus === 'resolved'}
                onClick={() => {
                  setHurdleStatus('resolved')
                  setHasUnsavedChanges(true)
                }}
              >
                乗り越えた
              </button>
            </div>
          )}
        </fieldset>
        <details
          className="optional-fields"
          open={optionalFieldsOpen}
          onToggle={(event) => setOptionalFieldsOpen(event.currentTarget.open)}
        >
          <summary>画像・ツール・タグ・作品リンクを追加（任意）</summary>
          <div className="optional-fields__body">
            <label className="form__field">
              使ったツール（カンマ区切り。AI も普通に書いてください）
              <input
                type="text"
                value={tools}
                onChange={(e) => {
                  setTools(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="Unity, Aseprite, Claude"
              />
            </label>
            <label className="form__field">
              ツールタグ（カンマ区切り・5 つまで。検索の入口になります）
              <input
                type="text"
                value={toolTags}
                onChange={(e) => {
                  setToolTags(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="unity, aseprite"
              />
            </label>
            <label className="form__field">
              つまずき・トピックタグ（カンマ区切り・5 つまで）
              <input
                type="text"
                value={topicTags}
                onChange={(e) => {
                  setTopicTags(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="当たり判定, ビルドエラー"
              />
            </label>
            <div className="form__field">
              画像（任意。PNG / JPEG / WebP、3MB まで）
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy || imageUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImageUploading(true)
                  setError('')
                  setImageWarnings([])
                  try {
                    // 選んだ時点で検査に通す。保存の段で初めて断られると、
                    // 書き上げた本文を前に画像だけ差し替える羽目になる
                    const result = await uploadImage(file)
                    setImage(result.image)
                    setImageWarnings(result.warnings)
                    setHasUnsavedChanges(true)
                  } catch (err) {
                    e.target.value = ''
                    setError(err instanceof ApiError ? err.message : '画像を保存できませんでした。')
                  } finally {
                    setImageUploading(false)
                  }
                }}
              />
              {imageUploading && (
                <span className="form__hint" role="status">
                  画像を確認中です。完了するまで公開・下書き保存はできません。
                </span>
              )}
              {image && (
                <span className="form__image-preview">
                  <img src={imageUrl(image)} alt="" width={image.width} height={image.height} />
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => {
                      setImage(null)
                      setImageAlt('')
                      setImageWarnings([])
                      setHasUnsavedChanges(true)
                    }}
                  >
                    画像を外す
                  </button>
                </span>
              )}
              {imageWarnings.map((warning) => (
                <span key={warning} className="notice">{warning}</span>
              ))}
            </div>
            {/* 説明の欄は画像を選んだときだけ出す。画像が無い人に
                「画像の説明」を見せても書きようがない（設計 I-5） */}
            {image && (
              <label className="form__field">
                この画像には何が写っていますか（任意・読み上げに使われます）
                <input
                  value={imageAlt}
                  maxLength={120}
                  onChange={(e) => {
                    setImageAlt(e.target.value)
                    setHasUnsavedChanges(true)
                  }}
                  placeholder="例: 当たり判定のズレを赤い枠で示した画面"
                />
                <span className="form__hint">
                  空のままでも保存できます（飾りの画像なら、それが正しい答えです）。
                </span>
              </label>
            )}
            <label className="form__field">
              GAMEYARD の作品リンク（任意）
              <input
                type="url"
                value={gameUrl}
                onChange={(e) => {
                  setGameUrl(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="https://play-game-yard.com/games/…"
              />
            </label>
          </div>
        </details>
        {/* 公開が何をするかを、押す前に全部言う（designs I-6）。
          3 つの要素を必ず保つ:
            (1) RSS に載ること（全体と作者別の 2 本あるが、文言では分けない）
            (2) 下書きに戻せること —— これを落として (3) だけ書くと脅しになる
            (3) 戻しても、RSS で配信済みのものには効かないこと
              （RSS 2.0 には配信の取り消しを伝える口が無い。RFC 6721 参照）
          RSS の口は CY_SITE_ORIGIN が無いと 503 を返す。本番は設定済み。
          **将来 RSS を止めるなら、この文も一緒に直すこと**（文言が嘘になる）。 */}
        <p className="notice">
          公開すると <Link prefetch={false} href="/stories/">Story 一覧</Link>・あなたの個人ページ・
          <a href={SITE_FEED}>RSS</a> に載ります。
          あとで下書きに戻せますが、RSS で受け取った人の手元からは消えません。
          下書きはあなたにしか見えません。
        </p>
        <div className="form__actions">
          <button type="button" className="button" disabled={busy || imageUploading} onClick={() => save('public')}>
            公開する
          </button>
          <button type="button" className="button button--ghost" disabled={busy || imageUploading} onClick={() => save('draft')}>
            下書き保存
          </button>
          {editId && (
            <button type="button" className="button button--danger" disabled={busy || imageUploading} onClick={remove}>
              削除する
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default function WritePage() {
  return (
    <Suspense fallback={<p className="notice">読み込み中…</p>}>
      <WriteInner />
    </Suspense>
  )
}

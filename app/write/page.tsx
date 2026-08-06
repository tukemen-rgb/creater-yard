'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
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

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tools, setTools] = useState('')
  const [toolTags, setToolTags] = useState('')
  const [topicTags, setTopicTags] = useState('')
  const [gameUrl, setGameUrl] = useState('')
  const [status, setStatus] = useState<'public' | 'draft'>('public')
  const [image, setImage] = useState<StoryImage | null>(null)
  const [imageWarnings, setImageWarnings] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!editId)

  useEffect(() => {
    if (!getHandle()) {
      router.replace('/login/')
      return
    }
    if (!editId) return
    api<{ story: Story }>(`/api/stories/${editId}.json`, { auth: true })
      .then(({ story }) => {
        if (story.authorHandle !== getHandle()) {
          setError('この Story を編集できるのは本人だけです。')
          return
        }
        setTitle(story.title)
        setBody(story.body)
        setTools(story.tools.join(', '))
        setToolTags(story.toolTags.join(', '))
        setTopicTags(story.topicTags.join(', '))
        setGameUrl(story.gameUrl)
        setStatus(story.status)
        setImage(story.image)
        setLoaded(true)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : '読み込めませんでした。'))
  }, [editId, router])

  const splitList = (value: string) =>
    value.split(/[,、，]/).map((item) => item.trim()).filter(Boolean)

  const save = async (saveStatus: 'public' | 'draft') => {
    setBusy(true)
    setError('')
    const payload = {
      title,
      body,
      tools: splitList(tools),
      toolTags: splitList(toolTags),
      topicTags: splitList(topicTags),
      gameUrl,
      status: saveStatus,
      imageId: image?.id ?? null,
    }
    try {
      const data = editId
        ? await api<{ story: Story }>(`/api/stories/${editId}`, { method: 'PUT', body: payload, auth: true })
        : await api<{ story: Story }>('/api/stories', { method: 'POST', body: payload, auth: true })
      router.push(saveStatus === 'public' ? `/story/${data.story.id}/` : '/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存できませんでした。')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editId) return
    // 消す前に 1 回だけ確かめる。記録は本人のものなので、確認さえ取れば止めない
    if (!window.confirm('この Story を削除します。元に戻せません。よろしいですか？')) return
    setBusy(true)
    try {
      await api<{ ok: boolean }>(`/api/stories/${editId}`, { method: 'DELETE', auth: true })
      router.push('/account/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除できませんでした。')
      setBusy(false)
    }
  }

  if (!loaded && !error) return <p className="notice">読み込み中…</p>

  return (
    <div className="page page--narrow">
      <h1>{editId ? 'Story を直す' : 'Story を書く'}</h1>
      <p className="page__lede">
        完成していなくていい。今日つまずいたこと、試したこと、それだけで 1 本になります。
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
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label className="form__field">
          本文
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            maxLength={8000}
            placeholder="何を作ろうとして、どこでつまずいて、どう抜けたか（抜けられていなくても）。"
          />
        </label>
        <label className="form__field">
          使ったツール（カンマ区切り。AI も普通に書いてください）
          <input
            type="text"
            value={tools}
            onChange={(e) => setTools(e.target.value)}
            placeholder="Unity, Aseprite, Claude"
          />
        </label>
        <label className="form__field">
          ツールタグ（カンマ区切り・5 つまで。検索の入口になります）
          <input
            type="text"
            value={toolTags}
            onChange={(e) => setToolTags(e.target.value)}
            placeholder="unity, aseprite"
          />
        </label>
        <label className="form__field">
          つまずき・トピックタグ（カンマ区切り・5 つまで）
          <input
            type="text"
            value={topicTags}
            onChange={(e) => setTopicTags(e.target.value)}
            placeholder="当たり判定, ビルドエラー"
          />
        </label>
        <div className="form__field">
          画像（任意。PNG / JPEG / WebP、3MB まで）
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setError('')
              setImageWarnings([])
              try {
                // 選んだ時点で検査に通す。保存の段で初めて断られると、
                // 書き上げた本文を前に画像だけ差し替える羽目になる
                const result = await uploadImage(file)
                setImage(result.image)
                setImageWarnings(result.warnings)
              } catch (err) {
                e.target.value = ''
                setError(err instanceof ApiError ? err.message : '画像を保存できませんでした。')
              }
            }}
          />
          {image && (
            <span className="form__image-preview">
              <img src={imageUrl(image)} alt="" width={image.width} height={image.height} />
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setImage(null)
                  setImageWarnings([])
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
        <label className="form__field">
          GAMEYARD の作品リンク（任意）
          <input
            type="url"
            value={gameUrl}
            onChange={(e) => setGameUrl(e.target.value)}
            placeholder="https://play-game-yard.com/games/…"
          />
        </label>
        <div className="form__actions">
          <button type="button" className="button" disabled={busy} onClick={() => save('public')}>
            公開する
          </button>
          <button type="button" className="button button--ghost" disabled={busy} onClick={() => save('draft')}>
            下書き保存
          </button>
          {editId && (
            <button type="button" className="button button--danger" disabled={busy} onClick={remove}>
              削除する
            </button>
          )}
        </div>
      </form>
      <p className="notice">
        公開すると <Link prefetch={false} href="/stories/">Story 一覧</Link> とあなたの個人ページに載ります。
        下書きはあなたにしか見えません。
      </p>
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

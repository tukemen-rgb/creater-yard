'use client'
/**
 * Story を書く（designs.md 2026-08-08 18:22 段階 C）。
 *
 * - 3 枠テンプレは見出し行を本文に挿すだけの補助。構造化しない
 *   （空欄が義務に見えると敷居が上がる。SPEC §1）
 * - 書きかけは localStorage に自動保存する。送信前の控えであって
 *   サーバーの下書きとは別物。投稿できたら消す
 * - タグの入力 UI は実装順④の番なのでここには無い
 */
import { useEffect, useRef, useState } from 'react'

import { createStory, isConfigured, me } from '../../lib/write-api'

const DRAFT_KEY = 'cy.write.draft'

type FormState = {
  title: string
  body: string
  tools: string
  hurdleText: string
  hurdleResolved: boolean
  gameyardUrl: string
  visibility: 'draft' | 'public'
}

const EMPTY: FormState = {
  title: '',
  body: '',
  tools: '',
  hurdleText: '',
  hurdleResolved: false,
  gameyardUrl: '',
  visibility: 'draft',
}

const TEMPLATE = {
  did: '## やったこと\n',
  hurdle: '## つまずいたこと\n',
  next: '## 次の一歩\n',
}

function loadDraft(): FormState {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

export default function WritePage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [handle, setHandle] = useState<string | null | 'loading'>('loading')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{ id: string; visibility: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const restored = useRef(false)

  useEffect(() => {
    // 復元は初回だけ。以後の変更を上書きしない
    if (!restored.current) {
      restored.current = true
      setForm(loadDraft())
    }
    me().then((account) => setHandle(account?.handle ?? null))
  }, [])

  useEffect(() => {
    // 書きかけの自動保存。ページを閉じても残る（投稿できたら消す）
    if (restored.current && typeof window !== 'undefined' && !saved) {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    }
  }, [form, saved])

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  if (!isConfigured()) {
    return (
      <div className="hero">
        <p className="eyebrow">準備中</p>
        <h1>Story を書く</h1>
        <p className="hero__lede">書く機能はまだ準備中です。もう少しだけお待ちください。</p>
      </div>
    )
  }

  if (handle === null) {
    return (
      <div className="hero">
        <p className="eyebrow">Story を書く</p>
        <h1>ログインが必要です</h1>
        <p className="hero__lede">
          <a href="/login/">ログイン</a>するか、<a href="/register/">登録</a>
          してください（必要なのはハンドルとパスワードだけです）。
        </p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="hero">
        <p className="eyebrow">おつかれさまです</p>
        <h1>{saved.visibility === 'public' ? '公開しました' : '下書きに保存しました'}</h1>
        <p className="hero__lede">
          書きかけの控えは消しました。続きはいつでも書き足せます。
        </p>
        <button type="button" className="auth-form__secondary" onClick={() => setSaved(null)}>
          もう 1 本書く
        </button>
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">Story を書く</p>
      <h1>今日の記録</h1>
      <p className="hero__lede">
        完成していなくていい。数字で競わない。AI を含め、使ったツールは普通に書く。
        ここはそういう場所です。
      </p>
      <form
        className="auth-form write-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            const story = await createStory({
              title: form.title,
              body: form.body,
              tools: form.tools
                .split(/[、,]/)
                .map((t) => t.trim())
                .filter(Boolean),
              ...(form.hurdleText.trim()
                ? {
                    hurdle: {
                      text: form.hurdleText,
                      status: form.hurdleResolved ? ('resolved' as const) : ('open' as const),
                    },
                  }
                : {}),
              ...(form.gameyardUrl.trim() ? { gameyardUrl: form.gameyardUrl } : {}),
              visibility: form.visibility,
            })
            window.localStorage.removeItem(DRAFT_KEY)
            setForm(EMPTY)
            setSaved({ id: story.id, visibility: story.visibility })
          } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました。')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          タイトル
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} required />
        </label>
        <div className="write-form__templates">
          テンプレを挿す:
          <button type="button" onClick={() => set({ body: form.body + TEMPLATE.did })}>
            やったこと
          </button>
          <button type="button" onClick={() => set({ body: form.body + TEMPLATE.hurdle })}>
            つまずいたこと
          </button>
          <button type="button" onClick={() => set({ body: form.body + TEMPLATE.next })}>
            次の一歩
          </button>
        </div>
        <label>
          本文（書きかけはこの端末に自動保存されます）
          <textarea
            value={form.body}
            onChange={(e) => set({ body: e.target.value })}
            rows={12}
            required
          />
        </label>
        <label>
          いま一番のつまずき（任意・200 字まで）
          <input value={form.hurdleText} onChange={(e) => set({ hurdleText: e.target.value })} />
        </label>
        {form.hurdleText.trim() && (
          <label className="write-form__inline">
            <input
              type="checkbox"
              checked={form.hurdleResolved}
              onChange={(e) => set({ hurdleResolved: e.target.checked })}
            />
            このつまずきは解決した
          </label>
        )}
        <label>
          使ったツール（読点かコンマ区切り。AI も普通に書く）
          <input
            value={form.tools}
            onChange={(e) => set({ tools: e.target.value })}
            placeholder="Godot、Aseprite、Claude"
          />
        </label>
        <label>
          GAMEYARD の作品 URL（任意）
          <input
            value={form.gameyardUrl}
            onChange={(e) => set({ gameyardUrl: e.target.value })}
            placeholder="https://play-game-yard.com/games/…"
          />
        </label>
        <div className="write-form__inline">
          <label className="write-form__inline">
            <input
              type="radio"
              name="visibility"
              checked={form.visibility === 'draft'}
              onChange={() => set({ visibility: 'draft' })}
            />
            下書き
          </label>
          <label className="write-form__inline">
            <input
              type="radio"
              name="visibility"
              checked={form.visibility === 'public'}
              onChange={() => set({ visibility: 'public' })}
            />
            公開
          </label>
        </div>
        {error && <p className="auth-form__error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? '保存しています…' : form.visibility === 'public' ? '公開する' : '下書きに保存'}
        </button>
      </form>
    </div>
  )
}

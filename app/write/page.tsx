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

import {
  createStory,
  fetchTagVocabulary,
  isConfigured,
  listMine,
  me,
  updateStory,
  type Story,
} from '../../lib/write-api'

const DRAFT_KEY = 'cy.write.draft'

type FormState = {
  title: string
  body: string
  tools: string
  tagTool: string
  tagTopic: string
  hurdleText: string
  hurdleResolved: boolean
  gameyardUrl: string
  visibility: 'draft' | 'public'
}

const EMPTY: FormState = {
  title: '',
  body: '',
  tools: '',
  tagTool: '',
  tagTopic: '',
  hurdleText: '',
  hurdleResolved: false,
  gameyardUrl: '',
  visibility: 'draft',
}

/** 読点・コンマ区切りの入力をタグ配列へ。正規化の本体は store 側 */
function splitTags(value: string): string[] {
  return value
    .split(/[、,]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

const TEMPLATE = {
  did: '## やったこと\n',
  hurdle: '## つまずいたこと\n',
  next: '## 次の一歩\n',
}

/** 編集する Story の id（/write/?id=<id>）。無ければ新規。 */
function editIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('id')
}

/** 保存済みの Story をフォームの形に戻す。 */
function toForm(story: Story): FormState {
  return {
    title: story.title,
    body: story.body,
    tools: (story.tools ?? []).join('、'),
    tagTool: (story.tags?.tool ?? []).join('、'),
    tagTopic: (story.tags?.topic ?? []).join('、'),
    hurdleText: story.hurdle?.text ?? '',
    hurdleResolved: story.hurdle?.status === 'resolved',
    gameyardUrl: story.gameyardUrl ?? '',
    // いま保存されている値を初期値にする。既定の draft を初期値にすると
    // 直しただけで公開が取り消される（proposals 14:15 で再現済み）
    visibility: story.visibility === 'public' ? 'public' : 'draft',
  }
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
  const [vocab, setVocab] = useState<{ tool: string[]; topic: string[] }>({ tool: [], topic: [] })
  const restored = useRef(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editState, setEditState] = useState<'none' | 'loading' | 'ok' | 'notfound'>('none')

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const id = editIdFromLocation()
    setEditId(id)
    if (id) {
      // 編集の初期値は「自分の分だけ」返る mine から探す。公開経路
      // (/api/stories/<id>.json) はトークンを送らないので下書きが取れず、
      // また他人の Story はこの結果に最初から入らないので認可が閉じる
      // （designs 2026-08-09 13:21 段階 B）
      setEditState('loading')
      listMine()
        .then((list) => {
          const found = list.find((story) => story.id === id)
          if (!found) {
            setEditState('notfound')
            return
          }
          setForm(toForm(found))
          setEditState('ok')
        })
        .catch(() => setEditState('notfound'))
    } else {
      // 新規のときだけ控えを復元する。編集は控えを読み込まない・消さない
      setForm(loadDraft())
    }
    me().then((account) => setHandle(account?.handle ?? null))
    fetchTagVocabulary().then(setVocab)
  }, [])

  useEffect(() => {
    // 書きかけの自動保存。ページを閉じても残る（投稿できたら消す）
    // 編集モードでは自動保存しない。鍵はオリジンに 1 つで期限が無いため、
    // 同じ鍵を使うと編集内容が次の新規作成に出てくる（事例 28）。
    // 編集対象はサーバーに保存済みなので控えの必要も薄い
    if (restored.current && !editId && typeof window !== 'undefined' && !saved) {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    }
  }, [form, saved, editId])

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

  if (editState === 'loading') {
    return (
      <div className="hero">
        <p className="eyebrow">Story を直す</p>
        <h1>読み込んでいます…</h1>
      </div>
    )
  }

  if (editState === 'notfound') {
    // 他人の id でも、消えた id でも同じ表示にする（存在を教えない）
    return (
      <div className="hero">
        <p className="eyebrow">Story を直す</p>
        <h1>見つかりません</h1>
        <p className="hero__lede">
          その記録は見つかりませんでした。<a href="/mine/">自分の記録</a>から選び直せます。
        </p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="hero">
        <p className="eyebrow">おつかれさまです</p>
        <h1>{saved.visibility === 'public' ? '公開しました' : '下書きに保存しました'}</h1>
        {/*
          できないことをできると書かない（⑤ 12:51・proposals 13:13 その 1）。
          編集モードと下書き一覧ができたら、この文言を事実に合わせて戻す。
        */}
        <p className="hero__lede">
          {saved.visibility === 'public'
            ? '書きかけの控えは消しました。'
            : '書きかけの控えは消しました。下書きは保存されていますが、開き直す画面はまだありません（用意しています）。'}
        </p>
        {/*
          公開のときだけ道筋を出す。下書きは /s/<id>/ でも /w/<handle>/ でも
          見えない（前者はシェルが Authorization を送らず、後者は公開分だけを
          引く）ので、出すと壊れたリンクになる（designs 12:21）。
        */}
        {saved.visibility === 'public' && (
          <p className="plan__note">
            <a href={`/s/${saved.id}/`}>公開した記録を見る</a>
            {handle && handle !== 'loading' && (
              <>
                {' ／ '}
                <a href={`/w/${handle}/`}>自分のページ</a>
              </>
            )}
            {' ／ '}
            <a href="/stories/">新着一覧</a>
          </p>
        )}
        {editId ? (
          <p className="plan__note">
            <a href="/mine/">自分の記録へ戻る</a> ／ <a href="/write/">新しく書く</a>
          </p>
        ) : (
          <button type="button" className="auth-form__secondary" onClick={() => setSaved(null)}>
            もう 1 本書く
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="hero">
      <p className="eyebrow">{editId ? 'Story を直す' : 'Story を書く'}</p>
      <h1>{editId ? '書いたものを直す' : '今日の記録'}</h1>
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
            // PUT は置き換えなので全項目を毎回送る。visibility を落とすと
            // 公開済みが黙って下書きに戻る（proposals 14:15 で再現済み）
            const input = {
              title: form.title,
              body: form.body,
              tools: splitTags(form.tools),
              tags: { tool: splitTags(form.tagTool), topic: splitTags(form.tagTopic) },
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
            }
            const story = editId ? await updateStory(editId, input) : await createStory(input)
            if (!editId) {
              // 控えは新規のときだけ持っている
              window.localStorage.removeItem(DRAFT_KEY)
            }
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
          つまずきタグ（ツール名。読点かコンマ区切り・5 個まで）
          <input
            value={form.tagTool}
            onChange={(e) => set({ tagTool: e.target.value })}
            list="tag-tool-options"
            placeholder="godot、aseprite"
          />
          <datalist id="tag-tool-options">
            {vocab.tool.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </label>
        <label>
          つまずきタグ（トピック。読点かコンマ区切り・5 個まで）
          <input
            value={form.tagTopic}
            onChange={(e) => set({ tagTopic: e.target.value })}
            list="tag-topic-options"
            placeholder="当たり判定、セーブ機能"
          />
          <datalist id="tag-topic-options">
            {vocab.topic.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
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

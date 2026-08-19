import type { Metadata } from 'next'

import { absoluteUrl, alternatesFor, ogWithUrl } from '../../lib/og'

/**
 * データの扱い。「集めない」と決めているものを明記する。
 * ここに書いたことは実装の事実と一致させる（書くだけの約束にしない）。
 * 集めるものを増やす変更は、先に社長の決定とこのページの更新が要る。
 */
/**
 * 貼られたときのカード（設計 A-2）。**この面は公開されていて貼られうる。**
 *
 * `og:url` を出すのは、`?utm_source=…` の付いたリンクが別の対象として
 * 扱われないようにするため（OGP の必須 4 項目の 1 つ・事例 36）。
 *
 * `openGraph` に題名と説明を明示するのは、layout の `title.template`
 * （`%s | CreatorYard`）が `og:title` にも当たり、**`og:site_name` と
 * ブランドが二重になる**ため。ブランドは `og:site_name` が運ぶ。
 */
const canonical = absoluteUrl('/data-policy/')
const title = 'データの扱い'
const description = 'CreatorYard が持つデータと、持たないと決めているデータ。'

export const metadata: Metadata = {
  title,
  description,
  alternates: alternatesFor(canonical),
  openGraph: { ...ogWithUrl(canonical, 'website'), title, description },
}

/**
 * 窓口のアドレス（I-7）。**ビルド時にサーバー側で読む。**
 *
 * 公開向けの接頭辞は要らない —— このページは両モードとも静的で、どんな方法で
 * 渡しても HTML に焼かれる。接頭辞を付けると JS バンドルにも入るだけ損である
 * （変えるには再ビルドが要る。アドレスの変更は稀で、再ビルドは配備手順に
 * 元々含まれるので受け入れる）。
 *
 * **検査を通らなければ null を返し、呼び側は節ごと出さない。**
 * 代わりの文言も置かない —— **置けば約束になり、無ければ約束にならない**
 *（I-10 で消した「果たせない約束」と同じ考え方）。
 *
 * 検査は 2 段である。1 段目の形式検査は**空白を弾くだけ**で、`<` や `"` は
 * 通ってしまう。だから 2 段目で記号を落とす。**1 段で足りると書いたら嘘になる。**
 */
function contactEmail(): string | null {
  const raw = (process.env.CY_CONTACT_EMAIL ?? '').trim()
  // 1 段目: メールの形。空白（改行・タブを含む）は通らない
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null
  // 2 段目: HTML と mailto への差し込みに使える記号を落とす。
  // `?` `&` は mailto のヘッダ差し込み（?cc=… や &subject=…）に使われる
  if (/[<>"'?&]/.test(raw)) return null
  return raw
}

export default function DataPolicyPage() {
  const contact = contactEmail()
  return (
    <div className="page page--narrow">
      <h1>データの扱い</h1>
      <p className="page__lede">
        持っているものと、持たないと決めているものを、そのまま書きます。
      </p>

      <section className="tag-section">
        <h2>持っているもの</h2>
        <ul>
          <li>
            <strong>アカウント</strong> — ハンドルとパスワード
            （パスワードは scrypt でハッシュ化して保存し、元の文字列は持ちません）。
            メールアドレスは任意で、パスワード再設定にだけ使います
          </li>
          <li>
            <strong>あなたが書いたもの</strong> — Story の本文・タグ・画像。
            下書きは公開されず、URL も持ちません
          </li>
          <li>
            <strong>短時間の通信記録</strong> — 接続元ごとの回数制限のために、
            送信元をメモリ上で短時間数えます（ディスクに残しません）
          </li>
        </ul>
      </section>

      <section className="tag-section">
        <h2>持たないと決めているもの</h2>
        <ul>
          <li>
            <strong>個人単位の行動記録</strong> — 誰がどのページを読んだかを
            記録しません。アクセス解析ツール・広告タグ・第三者のスクリプトは
            入れていません
          </li>
          <li><strong>閲覧数・読者の一覧</strong> — 持つのはサイト全体の合計値だけです</li>
          <li><strong>決済情報</strong> — 決済機能そのものがありません</li>
        </ul>
      </section>

      <section className="tag-section">
        <h2>消すとき</h2>
        <p>
          Story は本人がいつでも消せます。退会すると、アカウント・Story・画像の
          すべてが消えます。ハンドルだけは、なりすまし防止のため一定期間
          再登録できません（残るのはハンドルの文字列と退会日時だけです）。
        </p>
      </section>

      <section className="tag-section">
        <h2>画像について</h2>
        <p>
          アップロードされた画像は再エンコードしません。撮影情報（EXIF）が
          含まれる場合はそのまま公開されるため、アップロード時に検出して
          本人に警告を出します。
        </p>
      </section>

      {/* 窓口（I-7）。**未設定なら節ごと出ない。**代わりの文言も置かない。
          応答期限は書かない —— それは運営体制の約束であって、いま守れると
          確かめられていない。書けるのは「誰が見るか」だけである。
          註: この試験は註釈もソースとして読むので、ここに禁じた語を
          そのまま書くと赤くなる。今夜 3 回目である。 */}
      {contact && (
        <section className="tag-section">
          <h2>困ったとき・自分の記録について聞きたいとき</h2>
          <p>
            ログインできない・記録を消したい・扱いを聞きたい ——{' '}
            <a href={`mailto:${contact}`}>{contact}</a> へどうぞ
            （GAMEYARD と共通の窓口です。返信は人が最終確認します）。
          </p>
        </section>
      )}
    </div>
  )
}

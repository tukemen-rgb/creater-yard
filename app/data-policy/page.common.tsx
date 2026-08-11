import type { Metadata } from 'next'

/**
 * データの扱い。「集めない」と決めているものを明記する。
 * ここに書いたことは実装の事実と一致させる（書くだけの約束にしない）。
 * 集めるものを増やす変更は、先に社長の決定とこのページの更新が要る。
 */
export const metadata: Metadata = {
  title: 'データの扱い',
  description: 'CreatorYard が持つデータと、持たないと決めているデータ。',
}

export default function DataPolicyPage() {
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
    </div>
  )
}

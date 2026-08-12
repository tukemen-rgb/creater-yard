/**
 * ESLint の設定。
 *
 * 型検査（`tsc --noEmit`）では拾えないものを拾うために入れた。
 * 具体的には React Hooks の依存漏れ、未使用の変数と import、
 * 一覧の `key` の欠落、アクセシビリティの初歩。
 *
 * **最小限にする。** このリポジトリは依存を増やさない方針で、zip 読み取りも
 * PNG 生成も SMTP も自前で組んである。ESLint は開発時だけの依存として
 * 例外的に入れたものなので、規則を足すときは「型検査で拾えないか」を
 * 先に確かめること（AI Review Board / Issue #1 の判断）。
 *
 * 対象にしないもの:
 *   - out/ .next/ release/ … 生成物。直す対象ではない
 *   - server/store/ … 実行時のデータ
 *   - scripts/*.py … Python
 */
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const config = [
  {
    ignores: [
      '.next/**',
      '.next-static/**',
      '.next-server/**',
      'out/**',
      'release/**',
      'node_modules/**',
      'public/**',
      'server/store/**',
      'server/fixtures/**',
      'data/**',
      // Next.js が生成する。手で直すものではない
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      /*
       * 未使用は落とす。ただし `_` で始まるものは意図的に受け取っているとみなす
       * （引数の順番の都合で受け取らざるを得ないものがある）。
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          /*
           * `const { ownerId, ...rest } = record` は**内部 ID を落とすための書き方**で、
           * 取り出した変数を使わないのが目的。これを未使用として叱ると、
           * 落とす側の意図が読めない書き方に変えることになる。
           */
          ignoreRestSiblings: true,
        },
      ],
      /*
       * このサイトは画像を Next.js の最適化に通さない（静的書き出しでは
       * 最適化サーバーが使えず、投稿画像は別オリジンから配る）。
       * next/image への置き換えを促す規則は、その判断と噛み合わない。
       */
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config

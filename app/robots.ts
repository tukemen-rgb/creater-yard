/**
 * robots.txt（designs 2026-08-10 02:33 A-4）。
 *
 * 隠すものは無いので全部許可する。**下書きは焼かれていない**ので、
 * robots.txt で守るものが無い（守りを robots.txt に頼らない）。
 *
 * `CY_SITE_ORIGIN` が無いときは `Sitemap:` の行だけ落とす。
 * 相対 URL を書いても辿れないため。許可の行は出す
 * （robots.txt そのものが無いと 404 が増えるだけで益が無い）。
 */
import type { MetadataRoute } from 'next'

import { fileUrl } from '../lib/og'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  const sitemap = fileUrl('/sitemap.xml')
  return {
    rules: { userAgent: '*', allow: '/' },
    ...(sitemap ? { sitemap } : {}),
  }
}

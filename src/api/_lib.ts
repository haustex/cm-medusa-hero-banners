import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOptions } from "../lib/options"
import { bannerLocales, toAdminBanner, type AdminBanner } from "../lib/serialize"
import type { BannerRow } from "../lib/types"
import { hrefUrl } from "../lib/urls"
import { HbRuleError } from "../lib/validate"

const STATUS: Record<HbRuleError["code"], number> = {
  not_found: 404,
  invalid_url: 400,
  invalid_locale: 400,
  invalid_placement: 400,
  invalid_date: 400,
  invalid: 400,
  invalid_image: 400,
  file_too_large: 413,
}

/** Runs a handler; rule violations answer with { type, code, message, detail } (the Admin translates by code) */
export async function withRules(res: MedusaResponse, run: () => Promise<void>) {
  try {
    await run()
  } catch (e) {
    if (e instanceof HbRuleError) {
      const status = STATUS[e.code] ?? 400
      res.status(status).json({ type: status === 404 ? "not_found" : "invalid_data", code: e.code, message: e.message, detail: e.detail ?? null })
      return
    }
    throw e
  }
}

/** Admin banner shape + where its link leads per locale */
export function adminBannerView(req: MedusaRequest, b: BannerRow): AdminBanner {
  const o = getOptions(req.scope)
  const view = toAdminBanner(b)
  const locales = bannerLocales(b)
  const urls: Record<string, string> = {}
  const secondary_urls: Record<string, string> = {}
  for (const l of locales) {
    const u = hrefUrl(o, b.href, l, locales[0])
    if (u) urls[l] = u
    const s = hrefUrl(o, b.secondary_href, l, locales[0])
    if (s) secondary_urls[l] = s
  }
  return { ...view, urls, secondary_urls }
}

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOptions, PLACEMENT_RE } from "../../../lib/options"
import { storeBanners } from "../../../lib/store"
import type { StoreBannersQueryType } from "../../validators"

/**
 * GET /store/hero-banners?placement=home&locale=id — the banners visitors see now, in order, with the text in the
 * asked locale (`locale`, else the `x-medusa-locale` header, else each banner's default). Unknown placement → an
 * empty list. A storefront probes this route to detect the plugin.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = (req.validatedQuery ?? {}) as StoreBannersQueryType
  const o = getOptions(req.scope)
  const placement = (q.placement ?? o.placements[0]).toLowerCase()
  // Medusa itself moves a `locale` query parameter of store routes into req.locale (translations); the header stays
  const header = typeof req.headers["x-medusa-locale"] === "string" ? req.headers["x-medusa-locale"] : undefined
  const locale = q.locale || header || (req as MedusaRequest & { locale?: string }).locale
  const banners = PLACEMENT_RE.test(placement) && o.placements.includes(placement) ? await storeBanners(req.scope, placement, locale) : []
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ banners, placement })
}

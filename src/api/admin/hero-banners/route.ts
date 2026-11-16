import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminBannerView, withRules } from "../../_lib"
import { createBanner, listBanners } from "../../../lib/banners"
import { getOptions } from "../../../lib/options"
import type { AdminBannerBodyType, AdminListQueryType } from "../../validators"

/** GET /admin/hero-banners?placement=home — every banner of the placement (default: the first one), in order */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { placement } = (req.validatedQuery ?? {}) as AdminListQueryType
  const rows = await listBanners(req.scope, placement || getOptions(req.scope).placements[0])
  res.json({ banners: rows.map((b) => adminBannerView(req, b)) })
}

export async function POST(req: AuthenticatedMedusaRequest<AdminBannerBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    const banner = await createBanner(req.scope, req.validatedBody ?? {})
    res.status(201).json({ banner: adminBannerView(req, banner) })
  })
}

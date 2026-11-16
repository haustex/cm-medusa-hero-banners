import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminBannerView, withRules } from "../../../_lib"
import { reorderBanners } from "../../../../lib/banners"
import type { AdminReorderBodyType } from "../../../validators"

/** POST { ids: [...], placement? } — the banners in their new order (ids not listed keep their relative order after them) */
export async function POST(req: AuthenticatedMedusaRequest<AdminReorderBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    const rows = await reorderBanners(req.scope, req.validatedBody?.ids ?? [], req.validatedBody?.placement)
    res.json({ banners: rows.map((b) => adminBannerView(req, b)) })
  })
}

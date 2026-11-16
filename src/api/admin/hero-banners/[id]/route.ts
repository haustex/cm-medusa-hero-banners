import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminBannerView, withRules } from "../../../_lib"
import { deleteBanner, getBanner, updateBanner } from "../../../../lib/banners"
import type { AdminBannerBodyType } from "../../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    res.json({ banner: adminBannerView(req, await getBanner(req.scope, req.params.id)) })
  })
}

export async function POST(req: AuthenticatedMedusaRequest<AdminBannerBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    res.json({ banner: adminBannerView(req, await updateBanner(req.scope, req.params.id, req.validatedBody ?? {})) })
  })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    await deleteBanner(req.scope, req.params.id)
    res.json({ id: req.params.id, object: "hero_banner", deleted: true })
  })
}

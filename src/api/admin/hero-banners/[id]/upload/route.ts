import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminBannerView, withRules } from "../../../../_lib"
import { getBanner, service } from "../../../../../lib/banners"
import { placementChanged } from "../../../../../lib/revalidate"
import { removeUpload, storeUpload, type UploadInput } from "../../../../../lib/uploads"
import type { AdminUploadQueryType } from "../../../../validators"

/**
 * POST /admin/hero-banners/{id}/upload?slot=desktop|mobile  (multipart, field `file`)
 * Stores the image through the File Module (rotated, scaled down to the slot's maximum), replaces the slot's
 * previous upload (deleted) and answers { banner, image: { width, height } }. JPEG, PNG, WebP or AVIF by magic
 * bytes, at most 12 MB; SVG is refused.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const { slot } = req.validatedQuery as AdminUploadQueryType
    const banner = await getBanner(req.scope, req.params.id)
    const file = (req as AuthenticatedMedusaRequest & { file?: UploadInput }).file
    const image = await storeUpload(req.scope, service(req.scope), banner, slot, file as UploadInput)
    placementChanged(req.scope, banner.placement)
    res.json({ banner: adminBannerView(req, await getBanner(req.scope, banner.id)), image })
  })
}

/** DELETE /admin/hero-banners/{id}/upload?slot=…: removes the image (and the upload, when the banner owns it) */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const { slot } = req.validatedQuery as AdminUploadQueryType
    const banner = await getBanner(req.scope, req.params.id)
    await removeUpload(req.scope, service(req.scope), banner, slot)
    placementChanged(req.scope, banner.placement)
    res.json({ banner: adminBannerView(req, await getBanner(req.scope, banner.id)) })
  })
}

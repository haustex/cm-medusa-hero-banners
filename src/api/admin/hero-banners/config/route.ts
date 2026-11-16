import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOptions } from "../../../../lib/options"
import { MAX_UPLOAD_BYTES, MAX_WIDTH, UPLOAD_TYPES } from "../../../../lib/uploads"

/** Non-secret plugin options the Admin page adapts to */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const o = getOptions(req.scope)
  res.json({
    show_credit: o.showCredit,
    storefront_url: o.storefront.url,
    locales: o.locales,
    placements: o.placements,
    revalidate: !!o.revalidate,
    upload: { max_bytes: MAX_UPLOAD_BYTES, types: UPLOAD_TYPES, max_width: MAX_WIDTH },
  })
}

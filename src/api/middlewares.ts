import { defineMiddlewares, validateAndTransformBody, validateAndTransformQuery, type MedusaNextFunction, type MedusaRequest, type MedusaResponse } from "@medusajs/framework/http"
import multer from "multer"
import { MAX_UPLOAD_BYTES } from "../lib/uploads"
import { AdminBannerBody, AdminListQuery, AdminReorderBody, AdminUploadQuery, StoreBannersQuery } from "./validators"

/** One image in the multipart field `file`, kept in memory (at most MAX_UPLOAD_BYTES; larger → 413 right here) */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }).single("file")
function imageUpload(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  upload(req as any, res as any, (err: unknown) => {
    if (!err) return next()
    const code = (err as { code?: string }).code
    const tooLarge = code === "LIMIT_FILE_SIZE"
    res.status(tooLarge ? 413 : 400).json({ type: "invalid_data", code: tooLarge ? "file_too_large" : "invalid", message: tooLarge ? `The image may be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` : "Bad upload", detail: "file" })
  })
}

export default defineMiddlewares({
  routes: [
    { matcher: "/store/hero-banners", method: "GET", middlewares: [validateAndTransformQuery(StoreBannersQuery, {})] },
    { matcher: "/admin/hero-banners", method: "GET", middlewares: [validateAndTransformQuery(AdminListQuery, {})] },
    { matcher: "/admin/hero-banners", method: "POST", middlewares: [validateAndTransformBody(AdminBannerBody)] },
    { matcher: "/admin/hero-banners/reorder", method: "POST", middlewares: [validateAndTransformBody(AdminReorderBody)] },
    { matcher: "/admin/hero-banners/:id", method: "POST", middlewares: [validateAndTransformBody(AdminBannerBody)] },
    { matcher: "/admin/hero-banners/:id/upload", method: "POST", middlewares: [validateAndTransformQuery(AdminUploadQuery, {}), imageUpload] },
    { matcher: "/admin/hero-banners/:id/upload", method: "DELETE", middlewares: [validateAndTransformQuery(AdminUploadQuery, {})] },
  ],
})

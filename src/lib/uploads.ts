import type { IFileModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { randomBytes } from "node:crypto"
import sharp from "sharp"
import { COLUMN, IMAGE_SLOTS, type BannerFiles, type BannerRow, type ImageSlot } from "./types"
import { HbRuleError } from "./validate"

/**
 * The two images of a banner, stored through Medusa's File Module, so they land wherever the project keeps its
 * files (local `static`, S3, R2, …). Only raster images are accepted, recognised by their first bytes — the file
 * name and the declared MIME type are not trusted — and SVG never is (it can carry scripts). Before storing, the
 * image is rotated by its EXIF orientation and scaled down to the slot's maximum (desktop 2400 px wide, phone
 * 1200 px wide; smaller files are stored as they are), so a 12 MB camera photo never becomes the storefront's
 * source image. One file per slot: uploading again or removing deletes the previous file, so nothing piles up.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const
export type UploadType = (typeof UPLOAD_TYPES)[number]
/** Longest side the stored image may have per slot (desktop 12:5 → 2400×1000, phone 4:5 → 1200×1500) */
export const MAX_WIDTH: Record<ImageSlot, number> = { desktop: 2400, mobile: 1200 }

const EXT: Record<UploadType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }

/** The image type by magic bytes, null for anything else (SVG, GIF, HEIC, text, …) */
export function sniffImage(buf: Buffer): UploadType | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp"
  // ISO BMFF: size (4) + "ftyp" + major brand; AVIF files say avif or avis (sequence) in the major or compatible brands
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const boxLen = Math.min(buf.readUInt32BE(0) || 32, 64, buf.length)
    const brands = buf.subarray(8, boxLen).toString("latin1")
    if (/avif|avis/.test(brands) && !/heic|heix|mif1$/.test(brands.slice(0, 4))) return "image/avif"
    if (brands.slice(0, 4) === "avif" || brands.slice(0, 4) === "avis") return "image/avif"
  }
  return null
}

export const isSlot = (v: unknown): v is ImageSlot => typeof v === "string" && (IMAGE_SLOTS as string[]).includes(v)

const fileService = (container: MedusaContainer) => container.resolve<IFileModuleService>(Modules.FILE)

type BannerService = { updateHbBanners: (d: Record<string, unknown>) => Promise<unknown> }

/**
 * Rotates by EXIF, scales down to the slot's maximum width (never up) and re-encodes in the same format. A file
 * that is already small enough and carries no orientation is stored unchanged.
 */
export async function prepareImage(buf: Buffer, type: UploadType, slot: ImageSlot): Promise<{ buffer: Buffer; width: number; height: number }> {
  const img = sharp(buf, { failOn: "error", limitInputPixels: 80_000_000 }).rotate()
  const meta = await img.metadata()
  const width = meta.width ?? 0, height = meta.height ?? 0
  if (!width || !height) throw new HbRuleError("invalid_image", "The image could not be read", "file")
  const oriented = (meta.orientation ?? 1) !== 1
  const max = MAX_WIDTH[slot]
  if (width <= max && !oriented) return { buffer: buf, width, height }
  let out = img.resize({ width: Math.min(width, max), withoutEnlargement: true })
  if (type === "image/jpeg") out = out.jpeg({ quality: 85, mozjpeg: true })
  else if (type === "image/webp") out = out.webp({ quality: 85 })
  else if (type === "image/avif") out = out.avif({ quality: 60 })
  else out = out.png({ compressionLevel: 9 })
  const { data, info } = await out.toBuffer({ resolveWithObject: true })
  return { buffer: data, width: info.width, height: info.height }
}

/** Deletes the file the banner owns in `slot` (if any) and forgets its id; never throws (a missing file is fine) */
export async function releaseFile(container: MedusaContainer, banner: BannerRow, slot: ImageSlot): Promise<BannerFiles> {
  const files: BannerFiles = { ...(banner.files ?? {}) }
  const id = files[slot]
  if (id) {
    try {
      await fileService(container).deleteFiles([id])
    } catch (e) {
      container.resolve(ContainerRegistrationKeys.LOGGER).warn(`[hero-banners] could not delete file ${id} (${slot} of banner ${banner.id}): ${(e as Error).message}`)
    }
    files[slot] = null // null, not delete: JSON columns are merged on update
  }
  return files
}

/** When an admin pastes a different URL over an upload, the upload is deleted */
export async function filesAfterUrlChange(container: MedusaContainer, banner: BannerRow, slot: ImageSlot, nextUrl: string | null): Promise<BannerFiles | undefined> {
  const current = banner[COLUMN[slot]]
  if (!banner.files?.[slot] || nextUrl === current) return undefined
  return releaseFile(container, banner, slot)
}

/** On banner delete: every upload it owns */
export async function releaseAllFiles(container: MedusaContainer, banner: BannerRow): Promise<void> {
  for (const slot of IMAGE_SLOTS) if (banner.files?.[slot]) await releaseFile(container, banner, slot)
}

export type UploadInput = { buffer: Buffer; originalname?: string; mimetype?: string }

/** Stores the image in `slot` of `banner` (replacing the previous upload) and writes the banner's new column values */
export async function storeUpload(container: MedusaContainer, svc: BannerService, banner: BannerRow, slot: ImageSlot, file: UploadInput): Promise<{ width: number; height: number }> {
  if (!file?.buffer?.length) throw new HbRuleError("invalid", "No file was uploaded", "file")
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw new HbRuleError("file_too_large", `The image may be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`, "file")
  const type = sniffImage(file.buffer)
  if (!type) throw new HbRuleError("invalid_image", "Only JPEG, PNG, WebP and AVIF images are accepted (no SVG)", "file")
  let prepared: Awaited<ReturnType<typeof prepareImage>>
  try {
    prepared = await prepareImage(file.buffer, type, slot)
  } catch (e) {
    if (e instanceof HbRuleError) throw e
    throw new HbRuleError("invalid_image", "The image could not be read", "file")
  }
  const name = `hb-${slot}-${banner.id.replace(/^hbnr_/, "").slice(0, 12).toLowerCase()}-${randomBytes(4).toString("hex")}.${EXT[type]}`
  const created = await fileService(container).createFiles({ filename: name, mimeType: type, content: prepared.buffer.toString("base64"), access: "public" } as Parameters<IFileModuleService["createFiles"]>[0] & { access: "public" })
  const files = await releaseFile(container, banner, slot)
  files[slot] = created.id
  await svc.updateHbBanners({ id: banner.id, [COLUMN[slot]]: created.url, files })
  return { width: prepared.width, height: prepared.height }
}

/** Removes the image in `slot` (deleting the upload if the banner owns it) and its focal point */
export async function removeUpload(container: MedusaContainer, svc: BannerService, banner: BannerRow, slot: ImageSlot): Promise<void> {
  const files = await releaseFile(container, banner, slot)
  const focus = { ...(banner.focus ?? {}), [slot]: null }
  await svc.updateHbBanners({ id: banner.id, [COLUMN[slot]]: null, files, focus })
}

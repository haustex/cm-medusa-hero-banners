import type { Focus } from "./validate"

/** The two images of a banner; each is one URL column + one File Module id in `files` */
export type ImageSlot = "desktop" | "mobile"
export const IMAGE_SLOTS: ImageSlot[] = ["desktop", "mobile"]
export const COLUMN: Record<ImageSlot, "image_desktop" | "image_mobile"> = { desktop: "image_desktop", mobile: "image_mobile" }
/** Keys are set to null rather than removed: MikroORM merges JSON objects on update, a missing key keeps the old value */
export type BannerFiles = Partial<Record<ImageSlot, string | null>>
export type BannerFocus = Partial<Record<ImageSlot, Focus | null>>

export type BannerRow = {
  id: string
  name: string
  placement: string
  enabled: boolean
  rank: number
  href: string | null
  secondary_href: string | null
  image_desktop: string | null
  image_mobile: string | null
  focus: BannerFocus | null
  files: BannerFiles | null
  starts_at: Date | string | null
  ends_at: Date | string | null
  locales: string[]
  metadata: Record<string, unknown> | null
  created_at: Date | string
  updated_at: Date | string
  translations?: BannerTranslationRow[]
}
export type BannerTranslationRow = { id: string; locale: string; title: string; subtitle: string | null; cta: string | null; secondary_cta: string | null; alt: string | null; banner_id?: string }

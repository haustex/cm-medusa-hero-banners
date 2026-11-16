import { z } from "@medusajs/framework/zod"

/** Shapes only; the rules (URL safety, locales, placements, dates) are applied in src/lib/*. Unknown keys are dropped. */
const nullableString = (max: number) => z.string().max(max).nullable().optional()

export const AdminBannerBody = z.object({
  name: z.string().max(200).optional(),
  placement: z.string().max(64).optional(),
  enabled: z.boolean().optional(),
  rank: z.number().int().min(0).max(10_000).optional(),
  href: nullableString(2048),
  secondary_href: nullableString(2048),
  image_desktop: nullableString(2048),
  image_mobile: nullableString(2048),
  focus: z.object({ desktop: z.unknown().optional(), mobile: z.unknown().optional() }).optional(),
  starts_at: nullableString(40),
  ends_at: nullableString(40),
  locales: z.array(z.string().max(16)).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  translations: z.record(z.string().max(16), z.object({ title: z.string().max(200).optional(), subtitle: nullableString(600), cta: nullableString(100), secondary_cta: nullableString(100), alt: nullableString(400) })).optional(),
})
export type AdminBannerBodyType = z.infer<typeof AdminBannerBody>

export const AdminReorderBody = z.object({ ids: z.array(z.string().max(64)).max(500), placement: z.string().max(64).optional() })
export type AdminReorderBodyType = z.infer<typeof AdminReorderBody>

export const AdminListQuery = z.object({ placement: z.string().max(64).optional() })
export type AdminListQueryType = z.infer<typeof AdminListQuery>

export const AdminUploadQuery = z.object({ slot: z.enum(["desktop", "mobile"]) })
export type AdminUploadQueryType = z.infer<typeof AdminUploadQuery>

export const StoreBannersQuery = z.object({ placement: z.string().max(64).optional(), locale: z.string().max(16).optional() })
export type StoreBannersQueryType = z.infer<typeof StoreBannersQuery>

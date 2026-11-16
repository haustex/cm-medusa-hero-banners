/**
 * Typed helpers over `@medusajs/js-sdk` for the plugin's Store and Admin endpoints. Import from "medusa-hero-banners/sdk":
 *
 *   import Medusa from "@medusajs/js-sdk"
 *   import { heroBannersStore } from "medusa-hero-banners/sdk"
 *   const sdk = new Medusa({ baseUrl, publishableKey })
 *   const { banners } = await heroBannersStore(sdk).list({ placement: "home", locale: "id" })
 *
 * Only `sdk.client.fetch` is used, so any object with that shape works (your own fetch wrapper included).
 */
import type { AdminBanner, AdminBannerTranslation } from "./lib/serialize"
import type { StoreBanner } from "./lib/store"
import type { ImageSlot } from "./lib/types"
import type { Focus } from "./lib/validate"

export type { AdminBanner, AdminBannerTranslation, StoreBanner, ImageSlot, Focus }

export type FetchInit = { method?: string; body?: Record<string, any> | null; query?: Record<string, any>; headers?: Record<string, string>; cache?: RequestCache; next?: Record<string, unknown> }
export type FetchClient = { client: { fetch: <T>(path: string, init?: FetchInit) => Promise<T> } }
const bind = (sdk: FetchClient) => <T>(path: string, init?: FetchInit): Promise<T> => sdk.client.fetch<T>(path, init)

export function heroBannersStore(sdk: FetchClient) {
  const f = bind(sdk)
  return {
    /** The banners visitors see now in a placement (default: the plugin's first), text in `locale` */
    list: (query: { placement?: string; locale?: string } = {}, init?: Pick<FetchInit, "cache" | "next" | "headers">) => f<{ banners: StoreBanner[]; placement: string }>("/store/hero-banners", { query, ...init }),
  }
}

export type AdminConfig = {
  show_credit: boolean
  storefront_url: string | null
  /** Locales a new banner starts with (plugin option `locales`) */
  locales: string[]
  placements: string[]
  revalidate: boolean
  upload: { max_bytes: number; types: readonly string[]; max_width: Record<ImageSlot, number> }
}
export type AdminBannerInput = {
  name?: string
  placement?: string
  enabled?: boolean
  rank?: number
  href?: string | null
  secondary_href?: string | null
  image_desktop?: string | null
  image_mobile?: string | null
  focus?: { desktop?: Focus | null; mobile?: Focus | null }
  starts_at?: string | null
  ends_at?: string | null
  locales?: string[]
  metadata?: Record<string, unknown> | null
  translations?: Record<string, Partial<AdminBannerTranslation>>
}

export function heroBannersAdmin(sdk: FetchClient) {
  const f = bind(sdk)
  const base = "/admin/hero-banners"
  return {
    config: () => f<AdminConfig>(`${base}/config`),
    list: (placement?: string) => f<{ banners: AdminBanner[] }>(base, placement ? { query: { placement } } : undefined),
    get: (id: string) => f<{ banner: AdminBanner }>(`${base}/${id}`),
    create: (body: AdminBannerInput) => f<{ banner: AdminBanner }>(base, { method: "POST", body }),
    update: (id: string, body: AdminBannerInput) => f<{ banner: AdminBanner }>(`${base}/${id}`, { method: "POST", body }),
    delete: (id: string) => f<{ id: string; deleted: true }>(`${base}/${id}`, { method: "DELETE" }),
    reorder: (ids: string[], placement?: string) => f<{ banners: AdminBanner[] }>(`${base}/reorder`, { method: "POST", body: { ids, ...(placement ? { placement } : {}) } }),
    /** Uploads an image (JPEG/PNG/WebP/AVIF ≤ 12 MB) into a slot; it is scaled down to the slot's maximum and the previous upload is deleted */
    upload: (id: string, slot: ImageSlot, file: Blob) => {
      const form = new FormData()
      form.append("file", file, (file as File).name || `${slot}.bin`)
      // the browser sets the multipart boundary; the SDK's default JSON content type must go
      return f<{ banner: AdminBanner; image: { width: number; height: number } }>(`${base}/${id}/upload`, { method: "POST", query: { slot }, body: form as unknown as Record<string, any>, headers: { "content-type": null as unknown as string } })
    },
    removeUpload: (id: string, slot: ImageSlot) => f<{ banner: AdminBanner }>(`${base}/${id}/upload`, { method: "DELETE", query: { slot } }),
  }
}

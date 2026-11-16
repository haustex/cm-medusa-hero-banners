import { heroBannersAdmin } from "../../sdk"
import { sdk } from "./client"

export type { AdminBanner, AdminBannerInput, AdminConfig, Focus, ImageSlot } from "../../sdk"
export const api = heroBannersAdmin(sdk)

export const KEY = ["hero-banners"]
export const CONFIG_KEY = [...KEY, "config"]
export const listKey = (placement: string | undefined) => [...KEY, "list", placement ?? ""]
export const bannerKey = (id: string | undefined) => [...KEY, "banner", id]

/** ISO date → value of <input type="datetime-local"> in the browser's time zone */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
/** datetime-local value → ISO (null when empty) */
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

export const RULE_CODES = ["not_found", "invalid_url", "invalid_locale", "invalid_placement", "invalid_date", "invalid_image", "file_too_large", "invalid"] as const
export function errorOf(e: unknown): { code: string | null; message: string } {
  const err = e as { message?: string; code?: string; status?: number }
  const m = err?.message ?? String(e)
  const code = err?.code ?? (RULE_CODES.find((c) => m.startsWith(c)) ?? null)
  return { code, message: m }
}

export const splitLocales = (v: string) => v.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)

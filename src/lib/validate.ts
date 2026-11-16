/**
 * Input rules. A banner's link is either an absolute http(s) URL (no credentials, no control characters, at most
 * 2048 characters) or a storefront-relative path ("/store", never "//host"); nothing else is stored.
 */
export const MAX_URL = 2048

export class HbRuleError extends Error {
  constructor(
    public code: "not_found" | "invalid_url" | "invalid_locale" | "invalid_placement" | "invalid_date" | "invalid" | "invalid_image" | "file_too_large",
    message: string,
    public detail?: string
  ) {
    super(message)
  }
}

/** A safe absolute http(s) URL or null */
export function cleanUrl(input: unknown): string | null {
  if (typeof input !== "string") return null
  const s = input.trim()
  if (!s || s.length > MAX_URL || /[\u0000-\u001f\u007f]/.test(s)) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null
  if (u.username || u.password || !u.hostname) return null
  return u.href
}

/** A storefront-relative path: starts with one "/", no scheme, no control characters */
export function cleanPath(input: unknown): string | null {
  if (typeof input !== "string") return null
  const s = input.trim()
  if (!s.startsWith("/") || s.startsWith("//") || s.length > MAX_URL || /[\u0000-\u001f\u007f\s\\]/.test(s)) return null
  return s
}

/** The link of a banner: an absolute http(s) URL or a relative path; "" / null = no button */
export function cleanHref(input: unknown): string | null {
  if (input === null || input === undefined || input === "") return null
  const href = cleanPath(input) ?? cleanUrl(input)
  if (!href) throw new HbRuleError("invalid_url", "href must be a path (/store) or an absolute http(s) address", "href")
  return href
}

/** An image address: an absolute http(s) URL; "" / null = none */
export function cleanImage(input: unknown, field: string): string | null {
  if (input === null || input === undefined || input === "") return null
  const u = cleanUrl(input)
  if (!u) throw new HbRuleError("invalid_url", `${field} must be an absolute http(s) address`, field)
  return u
}

export const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "")
export const strOrNull = (v: unknown, max = 200): string | null => str(v, max) || null

/** ISO date string → Date, null for empty, throws for garbage */
export function cleanDate(input: unknown, field: string): Date | null {
  if (input === null || input === undefined || input === "") return null
  const d = new Date(typeof input === "string" || typeof input === "number" ? input : NaN)
  if (Number.isNaN(d.getTime())) throw new HbRuleError("invalid_date", `${field} is not a date`, field)
  return d
}

/** Focal point of an image in percent of its width and height, { x: 50, y: 50 } is the centre */
export type Focus = { x: number; y: number }
export function cleanFocus(input: unknown): Focus | null {
  if (!input || typeof input !== "object") return null
  const r = input as Record<string, unknown>
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v)
    return Number.isFinite(x) ? Math.min(100, Math.max(0, Math.round(x))) : null
  }
  const x = n(r.x), y = n(r.y)
  return x === null || y === null ? null : { x, y }
}

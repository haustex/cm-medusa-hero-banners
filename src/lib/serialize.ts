import { visibility } from "./schedule"
import type { BannerRow } from "./types"
import { cleanFocus, type Focus } from "./validate"

const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString())

export function bannerLocales(b: Pick<BannerRow, "locales">, fallback: string[] = ["en"]): string[] {
  return Array.isArray(b.locales) && b.locales.length ? (b.locales as string[]) : fallback
}

export type AdminBannerTranslation = { title: string; subtitle: string | null; cta: string | null; secondary_cta: string | null; alt: string | null }

export type AdminBanner = {
  id: string
  name: string
  placement: string
  enabled: boolean
  rank: number
  href: string | null
  secondary_href: string | null
  image: { desktop: string | null; mobile: string | null }
  /** Which images are uploads the plugin owns (as opposed to pasted URLs) */
  uploads: { desktop: boolean; mobile: boolean }
  /** Focal points in percent (null = centre) */
  focus: { desktop: Focus | null; mobile: Focus | null }
  starts_at: string | null
  ends_at: string | null
  visibility: "live" | "scheduled" | "expired" | "hidden"
  locales: string[]
  default_locale: string
  translations: Record<string, AdminBannerTranslation>
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  /** Filled by the route: where the links lead, per locale (storefront options) */
  urls?: Record<string, string>
  secondary_urls?: Record<string, string>
}

export function toAdminBanner(b: BannerRow, now = new Date()): AdminBanner {
  const locales = bannerLocales(b)
  return {
    id: b.id,
    name: b.name,
    placement: b.placement,
    enabled: b.enabled === true,
    rank: b.rank ?? 0,
    href: b.href ?? null,
    secondary_href: b.secondary_href ?? null,
    image: { desktop: b.image_desktop ?? null, mobile: b.image_mobile ?? null },
    uploads: { desktop: !!b.files?.desktop, mobile: !!b.files?.mobile },
    focus: { desktop: cleanFocus(b.focus?.desktop), mobile: cleanFocus(b.focus?.mobile) },
    starts_at: iso(b.starts_at),
    ends_at: iso(b.ends_at),
    visibility: visibility(b, now),
    locales,
    default_locale: locales[0],
    translations: Object.fromEntries((b.translations ?? []).map((t) => [t.locale, { title: t.title, subtitle: t.subtitle ?? null, cta: t.cta ?? null, secondary_cta: t.secondary_cta ?? null, alt: t.alt ?? null }])),
    metadata: b.metadata ?? null,
    created_at: iso(b.created_at)!,
    updated_at: iso(b.updated_at)!,
  }
}

/** Text in the asked locale, else the default locale's, else the first that has one */
export function pick<T extends { locale: string }>(rows: T[] | undefined, locale: string, defaultLocale: string): T | null {
  const r = rows ?? []
  return r.find((x) => x.locale === locale) ?? r.find((x) => x.locale === defaultLocale) ?? r[0] ?? null
}

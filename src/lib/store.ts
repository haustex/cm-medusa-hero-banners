import type { MedusaContainer } from "@medusajs/framework/types"
import { listBanners } from "./banners"
import { matchLocale } from "./locales"
import { isVisible } from "./schedule"
import { bannerLocales, pick } from "./serialize"
import type { BannerRow } from "./types"
import type { Focus } from "./validate"

/** One banner as the Store API hands it out: text in one locale, links as stored (the storefront resolves paths) */
export type StoreBanner = {
  id: string
  placement: string
  locale: string
  title: string
  subtitle: string | null
  /** Button label; null = the storefront's default */
  cta: string | null
  /** A storefront-relative path ("/store") or an absolute URL; null = no button */
  href: string | null
  /** A second, outlined button: shown when both its link and label exist */
  secondary: { href: string; cta: string } | null
  /** Both may be null (a text-only banner); one missing = the storefront uses the other for both viewports */
  image: { desktop: string | null; mobile: string | null }
  focus: { desktop: Focus | null; mobile: Focus | null }
  alt: string | null
  starts_at: string | null
  ends_at: string | null
  updated_at: string
}

const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString())

export function toStoreBanner(b: BannerRow, requested: unknown): StoreBanner {
  const locales = bannerLocales(b)
  const locale = matchLocale(requested, locales)
  const t = pick(b.translations, locale, locales[0])
  return {
    id: b.id,
    placement: b.placement,
    locale: t?.locale ?? locale,
    title: t?.title ?? b.name,
    subtitle: t?.subtitle ?? null,
    cta: t?.cta ?? null,
    href: b.href ?? null,
    secondary: b.secondary_href && t?.secondary_cta ? { href: b.secondary_href, cta: t.secondary_cta } : null,
    image: { desktop: b.image_desktop ?? null, mobile: b.image_mobile ?? null },
    focus: { desktop: b.focus?.desktop ?? null, mobile: b.focus?.mobile ?? null },
    alt: t?.alt ?? null,
    starts_at: iso(b.starts_at),
    ends_at: iso(b.ends_at),
    updated_at: iso(b.updated_at)!,
  }
}

/** The banners visitors see now in `placement`, in order, in the asked locale */
export async function storeBanners(container: MedusaContainer, placement: string, locale: unknown, now = new Date()): Promise<StoreBanner[]> {
  const rows = await listBanners(container, placement)
  return rows.filter((b) => isVisible(b, now)).map((b) => toStoreBanner(b, locale))
}

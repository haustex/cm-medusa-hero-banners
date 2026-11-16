import type { ResolvedOptions } from "./options"

/**
 * Where a banner's link leads for one locale, for the Admin: an absolute URL stays as it is; a relative path is put
 * under the storefront origin and the locale's prefix (or its own origin) from `storefront.locales`.
 */
export function hrefUrl(o: ResolvedOptions, href: string | null, locale: string, defaultLocale: string): string | null {
  if (!href) return null
  if (/^https?:\/\//i.test(href)) return href
  const base = o.storefront.url
  if (!base) return null
  const l = o.storefront.locales[locale] ?? (locale === defaultLocale ? o.storefront.locales[defaultLocale] : undefined) ?? {}
  const origin = (l.origin ?? base).replace(/\/+$/, "")
  const prefix = (l.prefix ?? "").replace(/\/+$/, "")
  const path = href === "/" ? "" : href
  return `${origin}${prefix}${path}` || `${origin}/`
}

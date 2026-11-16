/** Locale codes are BCP 47 tags ("id", "en", "pt-BR"); comparison is case-insensitive. */
export function normalizeLocale(code: unknown): string | null {
  if (typeof code !== "string") return null
  const raw = code.trim().replace(/_/g, "-")
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(raw)) return null
  const [lang, ...rest] = raw.split("-")
  const parts = rest.map((p) => (p.length === 2 ? p.toUpperCase() : p.length === 4 ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p.toLowerCase()))
  return [lang.toLowerCase(), ...parts].join("-")
}

export const languageOf = (code: string) => code.split("-")[0].toLowerCase()

/** Cleans a locale list: valid codes, no duplicates, at least one (`fallback`) */
export function cleanLocales(input: unknown, fallback: string[] = ["en"]): string[] {
  const out: string[] = []
  for (const raw of Array.isArray(input) ? input : []) {
    const code = normalizeLocale(typeof raw === "object" && raw ? (raw as { code?: unknown }).code : raw)
    if (code && !out.some((c) => c.toLowerCase() === code.toLowerCase())) out.push(code)
  }
  return out.length ? out : fallback
}

/**
 * Picks the locale a request asked for: exact code first, then the same language ("en-GB" → "en"), else the
 * default (the first locale).
 */
export function matchLocale(requested: unknown, locales: string[], fallback = locales[0]): string {
  const wanted = normalizeLocale(requested)
  if (!wanted) return fallback
  const exact = locales.find((l) => l.toLowerCase() === wanted.toLowerCase())
  if (exact) return exact
  const lang = languageOf(wanted)
  return locales.find((l) => languageOf(l) === lang) ?? fallback
}

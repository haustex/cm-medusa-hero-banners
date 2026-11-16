import fs from "node:fs"
import path from "node:path"
import type { ConfigModule, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const PACKAGE_NAME = "medusa-hero-banners"

export type PluginOptions = {
  /** Where the storefront lives, so the Admin can show where a banner's link leads */
  storefront?: {
    /** Public origin, e.g. "https://example.com" (no trailing slash) */
    url?: string
    /** Per locale: a path prefix ("" for none, "/us") or a different origin ("https://example.de") */
    locales?: Record<string, { prefix?: string; origin?: string }>
  }
  /** Locale codes a new banner starts with, the first is the default. Default ["en"] */
  locales?: string[]
  /** Places a banner can be shown; the storefront asks for one at a time. Default ["home"] */
  placements?: string[]
  /** Tell the storefront about public changes (batched): POST { hero_banners: { placements } } */
  revalidate?: {
    url: string
    /** Sent in the `x-revalidate-secret` header (or `header`) */
    secret?: string
    header?: string
    /** Changes within this window become one call. Default 2000 */
    delay_ms?: number
  }
  /** Show the small "by Haus Kayu" credit under the plugin's Admin page. Default false */
  showCredit?: boolean
}

export type ResolvedOptions = {
  storefront: { url: string | null; locales: Record<string, { prefix?: string; origin?: string }> }
  locales: string[]
  placements: string[]
  revalidate: { url: string; secret: string | null; header: string; delay_ms: number } | null
  showCredit: boolean
}

function num(value: unknown, fallback: number, min = 0): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= min ? n : fallback
}
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const origin = (v: unknown): string | null => str(v)?.replace(/\/+$/, "") ?? null
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [])

export const PLACEMENT_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export function resolveOptions(raw: PluginOptions | undefined): ResolvedOptions {
  const o = raw ?? {}
  const s = o.storefront ?? {}
  const placements = Array.from(new Set(list(o.placements).map((p) => p.toLowerCase()).filter((p) => PLACEMENT_RE.test(p))))
  const locales = Array.from(new Set(list(o.locales)))
  return {
    storefront: { url: origin(s.url), locales: s.locales && typeof s.locales === "object" ? s.locales : {} },
    locales: locales.length ? locales : ["en"],
    placements: placements.length ? placements : ["home"],
    revalidate: o.revalidate && str(o.revalidate.url) ? { url: str(o.revalidate.url)!, secret: str(o.revalidate.secret), header: str(o.revalidate.header) ?? "x-revalidate-secret", delay_ms: num(o.revalidate.delay_ms, 2000) } : null,
    showCredit: o.showCredit === true,
  }
}

type Entry = string | { resolve?: unknown; options?: unknown }

function packageNameAt(dir: string): string | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name ?? null
  } catch {
    return null
  }
}

/** A resolve string that points at this package: its name, a sub-path of it, or a local path to it */
export function isThisPackage(resolve: string): boolean {
  const r = resolve.replace(/\/+$/, "")
  if (r === PACKAGE_NAME || r.startsWith(`${PACKAGE_NAME}/`) || r.includes(`/${PACKAGE_NAME}`)) return true
  if (r.startsWith(".") || path.isAbsolute(r)) {
    for (let dir = path.resolve(r), i = 0; i < 6; i++, dir = path.dirname(dir)) {
      if (packageNameAt(dir) === PACKAGE_NAME) return true
    }
  }
  return false
}

const cache = new WeakMap<object, ResolvedOptions>()

/** The plugin's options (`plugins: [{ resolve, options }]`) with defaults applied; cached per container. */
export function getOptions(container: MedusaContainer): ResolvedOptions {
  const config: ConfigModule = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  const hit = cache.get(config)
  if (hit) return hit
  let raw: PluginOptions | undefined
  for (const p of (config.plugins ?? []) as Entry[]) {
    const resolve = typeof p === "string" ? p : p.resolve
    if (typeof resolve === "string" && isThisPackage(resolve)) {
      raw = typeof p === "string" ? {} : ((p.options as PluginOptions) ?? {})
      break
    }
  }
  const resolved = resolveOptions(raw)
  cache.set(config, resolved)
  return resolved
}

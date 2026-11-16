import type { MedusaContainer } from "@medusajs/framework/types"
import { HERO_BANNERS_MODULE } from "../modules/hero-banners"
import { cleanLocales, normalizeLocale } from "./locales"
import { getOptions, PLACEMENT_RE } from "./options"
import { placementChanged } from "./revalidate"
import { bannerLocales } from "./serialize"
import { COLUMN, IMAGE_SLOTS, type BannerFocus, type BannerRow, type BannerTranslationRow } from "./types"
import { filesAfterUrlChange, releaseAllFiles } from "./uploads"
import { cleanDate, cleanFocus, cleanHref, cleanImage, HbRuleError, str, strOrNull } from "./validate"

export const RELATIONS = ["translations"]

type Service = {
  listHbBanners: (f: Record<string, unknown>, c?: Record<string, unknown>) => Promise<BannerRow[]>
  createHbBanners: (d: Record<string, unknown>) => Promise<BannerRow>
  updateHbBanners: (d: Record<string, unknown> | Record<string, unknown>[]) => Promise<BannerRow | BannerRow[]>
  deleteHbBanners: (ids: string[]) => Promise<void>
  createHbBannerTranslations: (d: Record<string, unknown>[]) => Promise<BannerTranslationRow[]>
  updateHbBannerTranslations: (d: Record<string, unknown>[]) => Promise<BannerTranslationRow[]>
  deleteHbBannerTranslations: (ids: string[]) => Promise<void>
}
export const service = (container: MedusaContainer) => container.resolve<Service>(HERO_BANNERS_MODULE)

export type TranslationInput = { title?: string; subtitle?: string | null; cta?: string | null; secondary_cta?: string | null; alt?: string | null }
export type BannerInput = {
  name?: string
  placement?: string
  enabled?: boolean
  /** Position within the placement (0 first); others move aside. Omitted on create = last */
  rank?: number
  href?: string | null
  secondary_href?: string | null
  image_desktop?: string | null
  image_mobile?: string | null
  /** { desktop?: { x, y }, mobile?: { x, y } } in percent; a slot set to null goes back to the centre */
  focus?: { desktop?: unknown; mobile?: unknown }
  starts_at?: string | null
  ends_at?: string | null
  locales?: unknown
  metadata?: Record<string, unknown> | null
  translations?: Record<string, TranslationInput>
}

/** Focal points merged over the stored ones; a slot sent as null goes back to the centre (stored as null: JSON columns merge on update) */
function focusOf(input: BannerInput["focus"], base: BannerRow["focus"]): BannerFocus {
  const out: BannerFocus = { ...(base ?? {}) }
  for (const slot of IMAGE_SLOTS) {
    if (!input || !(slot in input)) continue
    out[slot] = cleanFocus(input[slot])
  }
  return out
}

function cleanPlacement(container: MedusaContainer, v: unknown, fallback?: string): string {
  const o = getOptions(container)
  if (v === undefined || v === null || v === "") return fallback ?? o.placements[0]
  const p = String(v).trim().toLowerCase()
  if (!PLACEMENT_RE.test(p) || !o.placements.includes(p)) throw new HbRuleError("invalid_placement", `placement must be one of ${o.placements.join(", ")}`, "placement")
  return p
}

function checkDates(starts: Date | null, ends: Date | null) {
  if (starts && ends && ends.getTime() <= starts.getTime()) throw new HbRuleError("invalid_date", "ends_at must be after starts_at", "ends_at")
}

/** Banners of one placement in order (every placement when none is given) */
export async function listBanners(container: MedusaContainer, placement?: string): Promise<BannerRow[]> {
  const rows = await service(container).listHbBanners(placement ? { placement } : {}, { relations: RELATIONS, order: { rank: "ASC", created_at: "ASC" }, take: 500 })
  return rows
}

export async function getBanner(container: MedusaContainer, id: string): Promise<BannerRow> {
  const [row] = await service(container).listHbBanners({ id }, { relations: RELATIONS, take: 1 })
  if (!row) throw new HbRuleError("not_found", "Banner not found")
  return row
}

/** Translations: every locale may have a title; the default locale always has a row (title = name until written) */
async function writeTranslations(container: MedusaContainer, banner: BannerRow, locales: string[], input: BannerInput["translations"] | undefined, existing: BannerTranslationRow[]) {
  const svc = service(container)
  const creates: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []
  for (const [rawCode, t] of Object.entries(input ?? {})) {
    const code = normalizeLocale(rawCode)
    if (!code || !locales.includes(code)) throw new HbRuleError("invalid_locale", `Locale "${rawCode}" is not one of the banner's locales`, rawCode)
    const row = existing.find((e) => e.locale === code)
    const data: Record<string, unknown> = {}
    if (t.title !== undefined) data.title = str(t.title, 160)
    if (t.subtitle !== undefined) data.subtitle = strOrNull(t.subtitle, 400)
    if (t.cta !== undefined) data.cta = strOrNull(t.cta, 60)
    if (t.secondary_cta !== undefined) data.secondary_cta = strOrNull(t.secondary_cta, 60)
    if (t.alt !== undefined) data.alt = strOrNull(t.alt, 300)
    if (row) updates.push({ id: row.id, ...data })
    else creates.push({ banner_id: banner.id, locale: code, title: str(t.title, 160) || banner.name, ...data })
  }
  const gone = existing.filter((e) => !locales.includes(e.locale)).map((e) => e.id)
  if (gone.length) await svc.deleteHbBannerTranslations(gone)
  if (updates.length) await svc.updateHbBannerTranslations(updates)
  if (creates.length) await svc.createHbBannerTranslations(creates)
  const have = [...existing.filter((e) => !gone.includes(e.id)).map((e) => e.locale), ...creates.map((c) => c.locale as string)]
  if (!have.includes(locales[0])) await svc.createHbBannerTranslations([{ banner_id: banner.id, locale: locales[0], title: banner.name }])
}

/** Writes ranks 0..n-1 in the given order (only rows whose rank changes) */
async function renumber(container: MedusaContainer, rows: BannerRow[]) {
  const updates = rows.map((b, i) => ({ id: b.id, rank: i })).filter((u, i) => rows[i].rank !== u.rank)
  if (updates.length) await service(container).updateHbBanners(updates)
}

/** Puts `banner` at `rank` among the other banners of its placement and renumbers them */
async function place(container: MedusaContainer, banner: BannerRow, rank: number | undefined) {
  const others = (await listBanners(container, banner.placement)).filter((b) => b.id !== banner.id)
  const at = rank === undefined ? others.length : Math.max(0, Math.min(others.length, Math.floor(rank)))
  others.splice(at, 0, banner)
  await renumber(container, others)
}

export async function createBanner(container: MedusaContainer, input: BannerInput): Promise<BannerRow> {
  const svc = service(container)
  const o = getOptions(container)
  const name = str(input.name, 120)
  if (!name) throw new HbRuleError("invalid", "name is required", "name")
  const placement = cleanPlacement(container, input.placement)
  const locales = cleanLocales(input.locales ?? o.locales, o.locales)
  const starts = cleanDate(input.starts_at, "starts_at"), ends = cleanDate(input.ends_at, "ends_at")
  checkDates(starts, ends)
  const banner = await svc.createHbBanners({
    name,
    placement,
    enabled: input.enabled === true,
    rank: 1_000_000, // placed below
    href: cleanHref(input.href),
    secondary_href: cleanHref(input.secondary_href),
    image_desktop: cleanImage(input.image_desktop, "image_desktop"),
    image_mobile: cleanImage(input.image_mobile, "image_mobile"),
    focus: focusOf(input.focus, null),
    files: null,
    starts_at: starts,
    ends_at: ends,
    locales,
    metadata: input.metadata ?? null,
  })
  await writeTranslations(container, banner, locales, input.translations, [])
  await place(container, banner, input.rank)
  placementChanged(container, placement)
  return getBanner(container, banner.id)
}

export async function updateBanner(container: MedusaContainer, id: string, input: BannerInput): Promise<BannerRow> {
  const svc = service(container)
  const banner = await getBanner(container, id)
  const data: Record<string, unknown> = { id }
  if (input.name !== undefined) {
    const name = str(input.name, 120)
    if (!name) throw new HbRuleError("invalid", "name is required", "name")
    data.name = name
  }
  const placement = input.placement !== undefined ? cleanPlacement(container, input.placement, banner.placement) : banner.placement
  if (placement !== banner.placement) data.placement = placement
  const locales = input.locales !== undefined ? cleanLocales(input.locales, bannerLocales(banner)) : bannerLocales(banner)
  if (input.locales !== undefined) data.locales = locales
  if (input.enabled !== undefined) data.enabled = input.enabled === true
  if (input.href !== undefined) data.href = cleanHref(input.href)
  if (input.secondary_href !== undefined) data.secondary_href = cleanHref(input.secondary_href)
  // a pasted URL over an upload: the upload is deleted and its id forgotten
  let files = banner.files ?? null
  for (const slot of IMAGE_SLOTS) {
    const col = COLUMN[slot]
    if (input[col] === undefined) continue
    const url = cleanImage(input[col], col)
    data[col] = url
    const next = await filesAfterUrlChange(container, { ...banner, files }, slot, url)
    if (next) files = next
  }
  if (files !== (banner.files ?? null)) data.files = files
  if (input.focus !== undefined) data.focus = focusOf(input.focus, banner.focus)
  const starts = input.starts_at !== undefined ? cleanDate(input.starts_at, "starts_at") : banner.starts_at ? new Date(banner.starts_at) : null
  const ends = input.ends_at !== undefined ? cleanDate(input.ends_at, "ends_at") : banner.ends_at ? new Date(banner.ends_at) : null
  checkDates(starts, ends)
  if (input.starts_at !== undefined) data.starts_at = starts
  if (input.ends_at !== undefined) data.ends_at = ends
  if (input.metadata !== undefined) data.metadata = input.metadata
  if (Object.keys(data).length > 1) await svc.updateHbBanners(data)
  if (input.translations !== undefined || input.locales !== undefined) {
    await writeTranslations(container, { ...banner, ...data } as BannerRow, locales, input.translations, banner.translations ?? [])
  }
  if (input.rank !== undefined || placement !== banner.placement) {
    await place(container, { ...banner, ...data } as BannerRow, input.rank ?? (placement !== banner.placement ? undefined : banner.rank))
    if (placement !== banner.placement) await renumber(container, (await listBanners(container, banner.placement)).filter((b) => b.id !== id))
  }
  placementChanged(container, placement, banner.placement)
  return getBanner(container, id)
}

export async function deleteBanner(container: MedusaContainer, id: string): Promise<void> {
  const banner = await getBanner(container, id)
  await service(container).deleteHbBanners([id])
  await releaseAllFiles(container, banner)
  await renumber(container, await listBanners(container, banner.placement))
  placementChanged(container, banner.placement)
}

/** The banners of one placement in a new order: listed ids first, the rest keep their relative order after them */
export async function reorderBanners(container: MedusaContainer, ids: string[], placement?: string): Promise<BannerRow[]> {
  const all = await listBanners(container)
  const byId = new Map(all.map((b) => [b.id, b]))
  const first = ids.length ? byId.get(ids[0]) : undefined
  const p = placement ? cleanPlacement(container, placement) : first?.placement ?? getOptions(container).placements[0]
  const rows = all.filter((b) => b.placement === p)
  const seen = new Set<string>()
  const ordered: BannerRow[] = []
  for (const i of ids) {
    const b = byId.get(i)
    if (!b || b.placement !== p) throw new HbRuleError("not_found", `Banner ${i} is not in placement "${p}"`, i)
    if (!seen.has(i)) {
      seen.add(i)
      ordered.push(b)
    }
  }
  for (const b of rows) if (!seen.has(b.id)) ordered.push(b)
  await renumber(container, ordered)
  placementChanged(container, p)
  return listBanners(container, p)
}

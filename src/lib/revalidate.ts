import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOptions } from "./options"

/**
 * With `revalidate.url` set: public changes are batched (delay_ms) and sent as one
 *   POST { hero_banners: { placements: ["home", …] } }
 * with the secret in the `x-revalidate-secret` header (or `revalidate.header`). A storefront re-renders the pages
 * that show those placements (Kiln: the home page in every market). Without the option nothing happens.
 */
type Batch = { placements: Set<string>; timer: NodeJS.Timeout | null }
const batch: Batch = { placements: new Set(), timer: null }

async function flush(container: MedusaContainer) {
  const o = getOptions(container).revalidate
  const body = { hero_banners: { placements: [...batch.placements].slice(0, 50) } }
  batch.placements = new Set()
  batch.timer = null
  if (!o) return
  let logger: Logger | null = null
  try {
    logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  } catch {}
  try {
    const res = await fetch(o.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(o.secret ? { [o.header]: o.secret } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    logger?.info(`[hero-banners] revalidate ${res.status} placements=${body.hero_banners.placements.join(",") || "-"}`)
  } catch (e) {
    logger?.warn(`[hero-banners] revalidate failed: ${(e as Error).message}`)
  }
}

/** Marks a placement as changed (also the previous one when a banner moved) */
export function placementChanged(container: MedusaContainer, placement: string, previous?: string | null) {
  const o = getOptions(container).revalidate
  if (!o) return
  batch.placements.add(placement)
  if (previous && previous !== placement) batch.placements.add(previous)
  if (!batch.timer) {
    batch.timer = setTimeout(() => void flush(container), o.delay_ms)
    batch.timer.unref?.()
  }
}

/** For tests: send what is pending now */
export const flushRevalidate = (container: MedusaContainer) => flush(container)

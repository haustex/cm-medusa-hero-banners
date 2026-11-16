import { Module } from "@medusajs/framework/utils"
import HeroBannersModuleService from "./service"

/** Module key and table prefix (`hb_*`) are unique on purpose so the plugin sits next to anything a project has. */
export const HERO_BANNERS_MODULE = "heroBanners"

export default Module(HERO_BANNERS_MODULE, {
  service: HeroBannersModuleService,
})

export type { default as HeroBannersModuleService } from "./service"

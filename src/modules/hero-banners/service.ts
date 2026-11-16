import { MedusaService } from "@medusajs/framework/utils"
import { Banner, BannerTranslation } from "./models"

/** Keys match the DML model names (hb_banner → HbBanner): `listHbBanners`, `createHbBanners`, … */
class HeroBannersModuleService extends MedusaService({
  HbBanner: Banner,
  HbBannerTranslation: BannerTranslation,
}) {}

export default HeroBannersModuleService

import { model } from "@medusajs/framework/utils"
import BannerTranslation from "./banner-translation"

/**
 * One hero banner (a slide of the home-page slider). Title, subtitle, button label and alt text per locale live in
 * the translations; `locales` lists the locales the banner is written in, the first one is the default. Banners are
 * ordered by `rank` within a `placement` ("home" unless the project defines more in the plugin options).
 */
const Banner = model
  .define("hb_banner", {
    id: model.id({ prefix: "hbnr" }).primaryKey(),
    /** Internal name shown in the Admin list */
    name: model.text(),
    /** Where the banner is shown; the storefront asks for one placement at a time */
    placement: model.text().default("home"),
    /** Shown to visitors (within the schedule) */
    enabled: model.boolean().default(false),
    /** Position within the placement, 0 first */
    rank: model.number().default(0),
    /** Where the button leads: a storefront-relative path ("/store") or an absolute https URL; null = no button */
    href: model.text().nullable(),
    /** An optional second button (outlined), same rules */
    secondary_href: model.text().nullable(),
    /** Wide image for desktops (12:5), tall image for phones (4:5): uploads through the plugin or https URLs */
    image_desktop: model.text().nullable(),
    image_mobile: model.text().nullable(),
    /** Focal points in percent: { desktop?: { x, y }, mobile?: { x, y } } */
    focus: model.json().nullable(),
    /** File Module ids of the uploads this banner owns: { desktop?, mobile? } (deleted on replace/remove) */
    files: model.json().nullable(),
    /** Optional schedule */
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    /** Locale codes in order, the first is the default ("id", "en") */
    locales: model.json(),
    metadata: model.json().nullable(),
    translations: model.hasMany(() => BannerTranslation, { mappedBy: "banner" }),
  })
  .indexes([{ on: ["placement", "rank"], where: "deleted_at IS NULL" }])
  .cascades({ delete: ["translations"] })

export default Banner

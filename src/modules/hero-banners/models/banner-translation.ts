import { model } from "@medusajs/framework/utils"
import Banner from "./banner"

const BannerTranslation = model
  .define("hb_banner_translation", {
    id: model.id({ prefix: "hbnrt" }).primaryKey(),
    locale: model.text(),
    /** Headline on the slide */
    title: model.text(),
    subtitle: model.text().nullable(),
    /** Button label; empty = the storefront's default ("Shop now") */
    cta: model.text().nullable(),
    /** Label of the second button; required for it to show */
    secondary_cta: model.text().nullable(),
    /** Alt text of the images in this locale */
    alt: model.text().nullable(),
    banner: model.belongsTo(() => Banner, { mappedBy: "translations" }),
  })
  .indexes([{ on: ["banner_id", "locale"], unique: true, where: "deleted_at IS NULL" }])

export default BannerTranslation

import { isThisPackage, resolveOptions } from "../options"
import { hrefUrl } from "../urls"

describe("options", () => {
  it("defaults", () => {
    const o = resolveOptions(undefined)
    expect(o.locales).toEqual(["en"])
    expect(o.placements).toEqual(["home"])
    expect(o.revalidate).toBeNull()
    expect(o.storefront.url).toBeNull()
  })
  it("cleans placements and locales, keeps the revalidate hook", () => {
    const o = resolveOptions({ placements: ["Home", "Checkout!", "promo-bar"], locales: ["id", "en"], storefront: { url: "https://shop.test/" }, revalidate: { url: "https://shop.test/api/revalidate", secret: "s" } })
    expect(o.placements).toEqual(["home", "promo-bar"])
    expect(o.locales).toEqual(["id", "en"])
    expect(o.storefront.url).toBe("https://shop.test")
    expect(o.revalidate).toEqual({ url: "https://shop.test/api/revalidate", secret: "s", header: "x-revalidate-secret", delay_ms: 2000 })
  })
  it("recognises its own resolve strings", () => {
    expect(isThisPackage("medusa-hero-banners")).toBe(true)
    expect(isThisPackage("./node_modules/medusa-hero-banners")).toBe(true)
    expect(isThisPackage("medusa-link-in-bio")).toBe(false)
  })
})

describe("hrefUrl", () => {
  const o = resolveOptions({ storefront: { url: "https://shop.test", locales: { id: { prefix: "" }, en: { prefix: "/us" }, de: { origin: "https://shop.de" } } } })
  it("puts a path under the storefront and the locale's prefix or origin", () => {
    expect(hrefUrl(o, "/store", "id", "id")).toBe("https://shop.test/store")
    expect(hrefUrl(o, "/store", "en", "id")).toBe("https://shop.test/us/store")
    expect(hrefUrl(o, "/", "en", "id")).toBe("https://shop.test/us")
    expect(hrefUrl(o, "/store", "de", "id")).toBe("https://shop.de/store")
    expect(hrefUrl(o, "https://wa.me/1", "en", "id")).toBe("https://wa.me/1")
    expect(hrefUrl(o, null, "en", "id")).toBeNull()
    expect(hrefUrl(resolveOptions(undefined), "/store", "en", "en")).toBeNull()
  })
})

import { cleanLocales, matchLocale, normalizeLocale } from "../locales"

describe("locales", () => {
  it("normalizes BCP 47", () => {
    expect(normalizeLocale("EN")).toBe("en")
    expect(normalizeLocale("pt_br")).toBe("pt-BR")
    expect(normalizeLocale("zh-hant")).toBe("zh-Hant")
    expect(normalizeLocale("x")).toBeNull()
  })
  it("cleans a list with a fallback", () => {
    expect(cleanLocales(["id", "EN", "id"])).toEqual(["id", "en"])
    expect(cleanLocales([], ["id", "en"])).toEqual(["id", "en"])
    expect(cleanLocales("nope")).toEqual(["en"])
  })
  it("matches a request", () => {
    expect(matchLocale("en-GB", ["id", "en"])).toBe("en")
    expect(matchLocale("fr", ["id", "en"])).toBe("id")
    expect(matchLocale(undefined, ["id", "en"])).toBe("id")
    expect(matchLocale("EN", ["id", "en"])).toBe("en")
  })
})

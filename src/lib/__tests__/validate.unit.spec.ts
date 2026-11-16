import { cleanDate, cleanFocus, cleanHref, cleanImage, cleanPath, cleanUrl, HbRuleError } from "../validate"

describe("cleanUrl", () => {
  it("keeps http(s) URLs and drops everything else", () => {
    expect(cleanUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1")
    expect(cleanUrl(" http://x.io ")).toBe("http://x.io/")
    expect(cleanUrl("javascript:alert(1)")).toBeNull()
    expect(cleanUrl("data:text/html,hi")).toBeNull()
    expect(cleanUrl("https://user:pw@example.com")).toBeNull()
    expect(cleanUrl("https://example.com/\u0000")).toBeNull()
    expect(cleanUrl(42)).toBeNull()
  })
})

describe("cleanPath / cleanHref", () => {
  it("accepts a storefront path and refuses protocol-relative or spaced ones", () => {
    expect(cleanPath("/store")).toBe("/store")
    expect(cleanPath("/categories/talenan?sort=new")).toBe("/categories/talenan?sort=new")
    expect(cleanPath("//evil.com")).toBeNull()
    expect(cleanPath("store")).toBeNull()
    expect(cleanPath("/a b")).toBeNull()
    expect(cleanPath("/a\\b")).toBeNull()
  })
  it("href: path or absolute URL, empty = null, garbage throws", () => {
    expect(cleanHref("/custom")).toBe("/custom")
    expect(cleanHref("https://wa.me/628")).toBe("https://wa.me/628")
    expect(cleanHref("")).toBeNull()
    expect(cleanHref(null)).toBeNull()
    expect(() => cleanHref("javascript:x")).toThrow(HbRuleError)
    expect(() => cleanHref("store")).toThrow(HbRuleError)
  })
  it("image: absolute only", () => {
    expect(cleanImage("https://media.example.com/a.jpg", "image_desktop")).toBe("https://media.example.com/a.jpg")
    expect(cleanImage("", "image_desktop")).toBeNull()
    expect(() => cleanImage("/hero/a.jpg", "image_desktop")).toThrow(HbRuleError)
  })
})

describe("cleanDate / cleanFocus", () => {
  it("dates", () => {
    expect(cleanDate("2026-12-01", "starts_at")?.toISOString()).toBe("2026-12-01T00:00:00.000Z")
    expect(cleanDate(null, "starts_at")).toBeNull()
    expect(() => cleanDate("soon", "starts_at")).toThrow(HbRuleError)
  })
  it("focus clamps to 0..100 and rounds", () => {
    expect(cleanFocus({ x: 120, y: -3 })).toEqual({ x: 100, y: 0 })
    expect(cleanFocus({ x: "33.6", y: 50 })).toEqual({ x: 34, y: 50 })
    expect(cleanFocus({ x: "a", y: 1 })).toBeNull()
    expect(cleanFocus(null)).toBeNull()
  })
})

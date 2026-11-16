import { isVisible, visibility } from "../schedule"

const now = new Date("2026-06-15T12:00:00Z")
const soon = "2026-06-16T00:00:00Z"
const past = "2026-06-14T00:00:00Z"

describe("schedule", () => {
  it("visibility", () => {
    expect(visibility({ enabled: true, starts_at: null, ends_at: null }, now)).toBe("live")
    expect(visibility({ enabled: false, starts_at: null, ends_at: null }, now)).toBe("hidden")
    expect(visibility({ enabled: true, starts_at: soon, ends_at: null }, now)).toBe("scheduled")
    expect(visibility({ enabled: true, starts_at: null, ends_at: past }, now)).toBe("expired")
    expect(visibility({ enabled: true, starts_at: new Date(past), ends_at: new Date(soon) }, now)).toBe("live")
  })
  it("isVisible follows it", () => {
    expect(isVisible({ enabled: true, starts_at: past, ends_at: soon }, now)).toBe(true)
    expect(isVisible({ enabled: true, starts_at: soon, ends_at: null }, now)).toBe(false)
    expect(isVisible({ enabled: true, starts_at: null, ends_at: now }, now)).toBe(false)
  })
})

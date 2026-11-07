import { describe, expect, it } from "vitest"
import { punchPhotoUrl, staffPhotoUrl } from "./photo-url"

describe("staffPhotoUrl", () => {
  it("returns the cache-busted profile photo url when the teacher has a photo", () => {
    expect(staffPhotoUrl({ id: "s1", profilePhotoId: "p9" })).toBe("/api/staff/s1/photo?v=p9")
  })

  it("returns undefined without a profile photo", () => {
    expect(staffPhotoUrl({ id: "s1", profilePhotoId: null })).toBeUndefined()
    expect(staffPhotoUrl({ id: "s1" })).toBeUndefined()
    expect(staffPhotoUrl({ id: "s1", profilePhotoId: "" })).toBeUndefined()
  })

  it("encodes ids so they cannot change the path or query", () => {
    expect(staffPhotoUrl({ id: "a/b", profilePhotoId: "x&y" })).toBe("/api/staff/a%2Fb/photo?v=x%26y")
  })
})

describe("punchPhotoUrl", () => {
  it("returns the punch photo url for an id", () => {
    expect(punchPhotoUrl("ph1")).toBe("/api/photos/ph1")
  })

  it("returns undefined without an id", () => {
    expect(punchPhotoUrl(null)).toBeUndefined()
    expect(punchPhotoUrl(undefined)).toBeUndefined()
    expect(punchPhotoUrl("")).toBeUndefined()
  })
})

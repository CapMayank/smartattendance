import { afterEach, describe, expect, it, vi } from "vitest"
import { triggerPhotoCleanup } from "@/lib/photo-cleanup-client"

afterEach(() => vi.unstubAllGlobals())

describe("triggerPhotoCleanup", () => {
  it("POSTs to the cleanup endpoint", () => {
    const fetchMock = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)
    triggerPhotoCleanup()
    expect(fetchMock).toHaveBeenCalledWith("/api/photos/cleanup", { method: "POST" })
  })

  it("swallows a rejected request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    expect(() => triggerPhotoCleanup()).not.toThrow()
    await new Promise((r) => setTimeout(r, 0)) // no unhandled rejection
  })

  it("swallows a synchronous throw", () => {
    vi.stubGlobal("fetch", () => { throw new Error("boom") })
    expect(() => triggerPhotoCleanup()).not.toThrow()
  })
})

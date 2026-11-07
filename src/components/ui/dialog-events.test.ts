import { describe, expect, it } from "vitest"
import { isOwnDialogEvent } from "./dialog-events"

describe("isOwnDialogEvent", () => {
  const outer = { name: "outer dialog" }
  const nested = { name: "nested dialog" }

  it("accepts an event fired by the dialog the handler is on", () => {
    expect(isOwnDialogEvent({ target: outer, currentTarget: outer })).toBe(true)
  })

  it("ignores an event that reached the handler from a nested dialog", () => {
    // React 19 dispatches a nested <dialog>'s close/cancel through every React ancestor.
    expect(isOwnDialogEvent({ target: nested, currentTarget: outer })).toBe(false)
  })

  it("ignores an event without a target", () => {
    expect(isOwnDialogEvent({ target: null, currentTarget: outer })).toBe(false)
  })
})

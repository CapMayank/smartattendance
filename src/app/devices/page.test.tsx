import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const mockDevices = [
  {
    id: "dev-1",
    name: "Front Gate BIO-PARK",
    serialNumber: "A250904118",
    ipAddress: "140.245.243.212",
    port: "7788",
    status: "ONLINE",
    lastPing: new Date().toISOString(),
  },
]

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url === "/api/devices") {
    return Promise.resolve({
      ok: true,
      json: async () => mockDevices,
    })
  }
  return Promise.resolve({
    ok: true,
    json: async () => ({}),
  })
})

import DevicesPage from "./page"

describe("Devices Page (/devices)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders device registration form including serial number input", () => {
    const html = renderToStaticMarkup(<DevicesPage />)

    expect(html).toContain("Devices")
    expect(html).toContain("Configure and monitor biometric devices")
    expect(html).toContain("Register device")
    expect(html).toContain("Device name")
    expect(html).toContain("Serial number (optional)")
    expect(html).toContain("new-serial")
    expect(html).toContain("IP address (optional)")
    expect(html).toContain("Port (optional)")
  })
})

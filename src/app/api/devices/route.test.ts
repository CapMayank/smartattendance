import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Session } from "next-auth"

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  device: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

import { getServerSession } from "next-auth/next"
import { GET, POST, PUT, DELETE } from "./route"

const mockGetServerSession = vi.mocked(getServerSession)

describe("Devices API (/api/devices)", () => {
  const adminUser = {
    id: "admin-1",
    role: "ADMIN",
    disabledAt: null,
    mustChangePassword: false,
    staff: null,
    approverDepartments: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    } as unknown as Session)
    mockPrisma.user.findUnique.mockResolvedValue(adminUser as never)
  })

  describe("GET /api/devices", () => {
    it("returns 403 for non-admin user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        role: "EMPLOYEE",
      } as never)

      const res = await GET()
      expect(res.status).toBe(403)
    })

    it("returns all devices ordered by createdAt desc", async () => {
      const mockDevices = [
        {
          id: "dev-1",
          name: "Front Gate BIO-PARK",
          serialNumber: "A250904118",
          ipAddress: "140.245.243.212",
          port: "7788",
          status: "ONLINE",
          lastPing: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      mockPrisma.device.findMany.mockResolvedValue(mockDevices as never)

      const res = await GET()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].serialNumber).toBe("A250904118")
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      })
    })
  })

  describe("POST /api/devices", () => {
    it("validates that device name is required", async () => {
      const req = new Request("http://localhost/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   ", serialNumber: "A250904118" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe("Device name is required")
    })

    it("creates a device with trimmed serialNumber, ipAddress, and port", async () => {
      mockPrisma.device.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "dev-new", ...data })
      )

      const req = new Request("http://localhost/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: " Front Gate BIO-PARK ",
          serialNumber: " A250904118 ",
          ipAddress: " 140.245.243.212 ",
          port: " 7788 ",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe("dev-new")
      expect(mockPrisma.device.create).toHaveBeenCalledWith({
        data: {
          name: "Front Gate BIO-PARK",
          serialNumber: "A250904118",
          ipAddress: "140.245.243.212",
          port: "7788",
        },
      })
    })

    it("converts empty serialNumber string to null to prevent unique constraint collisions", async () => {
      mockPrisma.device.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "dev-new", ...data })
      )

      const req = new Request("http://localhost/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Backdoor Reader",
          serialNumber: "   ",
          ipAddress: "",
          port: "",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(mockPrisma.device.create).toHaveBeenCalledWith({
        data: {
          name: "Backdoor Reader",
          serialNumber: null,
          ipAddress: null,
          port: null,
        },
      })
    })

    it("returns 400 when serialNumber already exists (P2002)", async () => {
      const p2002Error = new Error("Unique constraint failed") as Error & { code?: string }
      p2002Error.code = "P2002"
      mockPrisma.device.create.mockRejectedValue(p2002Error)

      const req = new Request("http://localhost/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Front Gate",
          serialNumber: "A250904118",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe("A device with this serial number already exists")
    })
  })

  describe("PUT /api/devices", () => {
    it("returns 400 when id is missing", async () => {
      const req = new Request("http://localhost/api/devices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      })

      const res = await PUT(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe("ID required")
    })

    it("updates device serialNumber, name, and network settings", async () => {
      mockPrisma.device.update.mockResolvedValue({
        id: "dev-1",
        name: "Front Gate BIO-PARK Updated",
        serialNumber: "A250904118",
        ipAddress: "140.245.243.212",
        port: "7788",
      } as never)

      const req = new Request("http://localhost/api/devices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "dev-1",
          name: " Front Gate BIO-PARK Updated ",
          serialNumber: " A250904118 ",
          ipAddress: " 140.245.243.212 ",
          port: " 7788 ",
        }),
      })

      const res = await PUT(req)
      expect(res.status).toBe(200)
      expect(mockPrisma.device.update).toHaveBeenCalledWith({
        where: { id: "dev-1" },
        data: {
          name: "Front Gate BIO-PARK Updated",
          serialNumber: "A250904118",
          ipAddress: "140.245.243.212",
          port: "7788",
        },
      })
    })

    it("returns 400 when updating serialNumber violates unique constraint (P2002)", async () => {
      const p2002Error = new Error("Unique constraint failed") as Error & { code?: string }
      p2002Error.code = "P2002"
      mockPrisma.device.update.mockRejectedValue(p2002Error)

      const req = new Request("http://localhost/api/devices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "dev-1",
          serialNumber: "A250904118",
        }),
      })

      const res = await PUT(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe("A device with this serial number already exists")
    })
  })

  describe("DELETE /api/devices", () => {
    it("returns 400 when id param is missing", async () => {
      const req = new Request("http://localhost/api/devices", {
        method: "DELETE",
      })

      const res = await DELETE(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe("ID required")
    })

    it("deletes the device by id", async () => {
      mockPrisma.device.delete.mockResolvedValue({ id: "dev-1" } as never)

      const req = new Request("http://localhost/api/devices?id=dev-1", {
        method: "DELETE",
      })

      const res = await DELETE(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(mockPrisma.device.delete).toHaveBeenCalledWith({
        where: { id: "dev-1" },
      })
    })
  })
})

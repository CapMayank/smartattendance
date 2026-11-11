import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  systemSetting: {
    findUnique: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { getSetupSecret, isSetupCompleted, verifySetupSecret } from "./setup";

describe("setup helpers (src/lib/setup.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SETUP_SECRET;
    delete process.env.INITIAL_SETUP_KEY;
  });

  describe("isSetupCompleted", () => {
    it("returns true when SETUP_COMPLETED setting is 'true'", async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: "s-1",
        key: "SETUP_COMPLETED",
        value: "true",
      });

      const result = await isSetupCompleted();
      expect(result).toBe(true);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: "SETUP_COMPLETED" },
      });
    });

    it("returns false when SETUP_COMPLETED setting is absent and an admin has staffId === null", async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "u-1",
        role: "ADMIN",
        staffId: null,
      });

      const result = await isSetupCompleted();
      expect(result).toBe(false);
    });

    it("returns false when SETUP_COMPLETED setting value is 'false'", async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: "s-1",
        key: "SETUP_COMPLETED",
        value: "false",
      });

      const result = await isSetupCompleted();
      expect(result).toBe(false);
    });

    it("returns false when no SETUP_COMPLETED setting exists", async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await isSetupCompleted();
      expect(result).toBe(false);
    });
  });

  describe("getSetupSecret and verifySetupSecret", () => {
    it("reads default secret when no environment variables are set", () => {
      expect(getSetupSecret()).toBe("intime-sarvodaya-setup-2026");
      expect(verifySetupSecret("intime-sarvodaya-setup-2026")).toBe(true);
      expect(verifySetupSecret("wrong")).toBe(false);
    });

    it("prefers SETUP_SECRET when set", () => {
      process.env.SETUP_SECRET = "custom-secret-key-123";
      process.env.INITIAL_SETUP_KEY = "fallback-key";

      expect(getSetupSecret()).toBe("custom-secret-key-123");
      expect(verifySetupSecret("custom-secret-key-123")).toBe(true);
    });

    it("falls back to INITIAL_SETUP_KEY when SETUP_SECRET is unset", () => {
      process.env.INITIAL_SETUP_KEY = "initial-fallback-key";

      expect(getSetupSecret()).toBe("initial-fallback-key");
      expect(verifySetupSecret("initial-fallback-key")).toBe(true);
    });
  });

  describe("production secret", () => {
    it("has no built-in secret in production, so setup stays locked until one is configured", () => {
      const original = process.env.NODE_ENV;
      vi.stubEnv("NODE_ENV", "production");
      try {
        expect(getSetupSecret()).toBe("");
        expect(verifySetupSecret("intime-sarvodaya-setup-2026")).toBe(false);
        expect(verifySetupSecret("")).toBe(false);
        process.env.SETUP_SECRET = "real-secret";
        expect(verifySetupSecret("real-secret")).toBe(true);
      } finally {
        vi.unstubAllEnvs();
        delete process.env.SETUP_SECRET;
        expect(process.env.NODE_ENV).toBe(original);
      }
    });
  });
});

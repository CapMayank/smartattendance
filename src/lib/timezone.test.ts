import { describe, it, expect } from "vitest";
import { ensureSchoolTimezone } from "./timezone";

describe("ensureSchoolTimezone", () => {
  it("forces Asia/Kolkata regardless of the existing value", () => {
    const env: Record<string, string | undefined> = { TZ: "UTC" };
    expect(ensureSchoolTimezone(env)).toBe("Asia/Kolkata");
    expect(env.TZ).toBe("Asia/Kolkata");
  });
  it("sets it when unset", () => {
    const env: Record<string, string | undefined> = {};
    ensureSchoolTimezone(env);
    expect(env.TZ).toBe("Asia/Kolkata");
  });
});

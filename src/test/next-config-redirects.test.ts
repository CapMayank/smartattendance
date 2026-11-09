import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("NextConfig redirects", () => {
  it("defines a permanent redirect from legacy /punches/requests to /requests?tab=punches", async () => {
    expect(nextConfig.redirects).toBeDefined();
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual({
      source: "/punches/requests",
      destination: "/requests?tab=punches",
      permanent: true,
    });
  });
});

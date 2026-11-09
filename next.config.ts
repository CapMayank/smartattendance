import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/punches/requests",
        destination: "/requests?tab=punches",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

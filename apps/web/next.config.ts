import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saku/shared", "@saku/db"],
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Cukup untuk mengunggah file backup database (.dump/.sql).
      bodySizeLimit: "64mb",
    },
  },
};

export default nextConfig;

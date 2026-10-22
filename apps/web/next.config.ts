import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saku/shared", "@saku/db"],
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;

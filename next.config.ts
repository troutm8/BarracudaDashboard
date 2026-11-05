import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "assets.leaguestat.com" }],
  },
};

export default nextConfig;

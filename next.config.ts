import type { NextConfig } from "next";
import { PREFECTURES } from "./src/lib/master";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // /area/aichi などは一覧（/search?pref=23）に集約する
  async redirects() {
    return PREFECTURES.map((p) => ({
      source: `/area/${p.slug}`,
      destination: `/search?pref=${p.code}`,
      permanent: true,
    }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // imagen mínima para Docker / Coolify
  output: "standalone",
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

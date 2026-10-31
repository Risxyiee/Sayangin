import type { NextConfig } from "next";

// Catatan deploy: produksi memakai Cloudflare Workers via @opennextjs/cloudflare
// (lihat wrangler.jsonc & script build:cf/deploy:cf). `output: "standalone"`
// dihapus karena OpenNext menangani bundling worker-nya sendiri.
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

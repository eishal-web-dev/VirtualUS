import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // We run lint separately in CI/dev via `npm run lint`.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: {
    qualities: [100, 70, 75],
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals as any[]),
        '@sparticuz/chromium',
        'puppeteer-extra-plugin-stealth',
        'clone-deep',
        'playwright-extra',
      ];
    }
    return config;
  },
};

export default nextConfig;

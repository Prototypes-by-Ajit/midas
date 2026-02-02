import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const floatingUiReactDomDir = path.dirname(
  require.resolve("@floating-ui/react-dom/package.json")
);
const floatingUiReactDomEsm = path.join(
  floatingUiReactDomDir,
  "dist",
  "floating-ui.react-dom.mjs"
);

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  transpilePackages: ['framer-motion'],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@floating-ui/react-dom": floatingUiReactDomEsm,
    };
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next"
import { createRequire } from "module"
import { fileURLToPath } from "url"
import path from "path"

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const floatingUiReactDomDir = path.dirname(
  require.resolve("@floating-ui/react-dom/package.json")
)
const floatingUiReactDomEsm = path.join(
  floatingUiReactDomDir,
  "dist",
  "floating-ui.react-dom.mjs"
)

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, ".."),

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    // Keep this to avoid remote image optimization + network dependency in CI/Docker builds
    unoptimized: true,
  },

  transpilePackages: ["framer-motion"],

  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@floating-ui/react-dom": floatingUiReactDomEsm,
    }
    return config
  },
}

export default nextConfig;

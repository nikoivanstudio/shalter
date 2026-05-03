import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactCompiler: true,
  deploymentId: process.env.DEPLOYMENT_VERSION,
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false
    }

    return config
  },
}

export default nextConfig

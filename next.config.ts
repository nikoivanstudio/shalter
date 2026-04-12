import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  deploymentId: process.env.DEPLOYMENT_VERSION,
};

export default nextConfig;

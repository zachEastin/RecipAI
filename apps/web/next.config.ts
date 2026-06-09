import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@recipai/ai", "@recipai/db", "@recipai/recipes"]
};

export default nextConfig;

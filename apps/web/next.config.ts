import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: [
    "@recipai/ai",
    "@recipai/db",
    "@recipai/meal-planning",
    "@recipai/recipes"
  ]
};

export default nextConfig;

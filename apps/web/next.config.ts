import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: [
    "@recipai/ai",
    "@recipai/db",
    "@recipai/meal-planning",
    "@recipai/recipes",
    "@recipai/shopping-list"
  ]
};

export default nextConfig;

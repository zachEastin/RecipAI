import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@recipai/ai", "@recipai/recipes"]
};

export default nextConfig;

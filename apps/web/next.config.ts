import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@recipai/ai", "@recipai/db", "@recipai/recipes"]
};

export default nextConfig;

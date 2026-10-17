import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Les photos de preuve passent par les server actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;

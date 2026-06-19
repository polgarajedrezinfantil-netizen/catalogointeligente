import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Permite servir fotos del Storage público de Supabase.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/**" },
    ],
  },
};

export default nextConfig;

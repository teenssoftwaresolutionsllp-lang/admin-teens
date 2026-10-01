import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "@napi-rs/canvas",
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'sqrxsdcqesfqzsoshwfb.supabase.co',
      }
    ],
    
  },
};

export default nextConfig;

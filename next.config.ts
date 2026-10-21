import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't expose framework version in response headers
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },

  // The application serves no remote next/image sources. Keep the optimizer
  // closed to third-party Supabase projects and arbitrary uploaded images.
  images: { remotePatterns: [] },
};

export default nextConfig;

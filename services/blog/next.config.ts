import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.dokploy.creco.dev',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
    ],
  },
};

export default nextConfig;

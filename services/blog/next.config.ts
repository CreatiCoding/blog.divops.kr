import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'blog.creco.dev' }],
        destination: 'https://blog.divops.kr/:path*',
        permanent: true,
      },
    ];
  },
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
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'divopsor.github.io',
      },
      {
        protocol: 'https',
        hostname: '*.notion.site',
      },
    ],
  },
};

export default nextConfig;

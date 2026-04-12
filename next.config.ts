import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/logo.png',
        destination: '/foronors-logo.svg'
      }
    ];
  }
};

export default nextConfig;

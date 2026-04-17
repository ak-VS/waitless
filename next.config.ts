import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/customer',
        has: [{ type: 'query', key: 'r' }],
        destination: '/customer/floor?r=:r',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
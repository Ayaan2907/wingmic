import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;

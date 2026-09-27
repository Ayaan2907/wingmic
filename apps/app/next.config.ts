import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // the dev-tools badge defaults to bottom-left, where it lands on the bay's
  // HUD/status pill and intro dialog (QA logged it as a "compass" overlap)
  devIndicators: { position: 'top-right' },
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;

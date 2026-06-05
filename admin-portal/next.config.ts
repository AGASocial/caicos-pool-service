import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Optimize image loading
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'appleid.cdn-apple.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.gstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 60,
  },
  // Enable React strict mode for better development
  reactStrictMode: true,
  // Turbopack configuration
  turbopack: {
    // Pin the workspace root to this app directory. Without this, Next 16
    // infers the git repo root (caicos/) as the root and resolves CSS module
    // imports like `@import "tailwindcss"` against caicos/node_modules, which
    // doesn't exist — spamming "Can't resolve 'tailwindcss'" on every compile.
    root: __dirname,
    resolveAlias: {
      '@/*': ['./src/*'],
    },
  },
};

export default withNextIntl(nextConfig);

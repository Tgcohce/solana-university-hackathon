/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true, // Skip type checking during build
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;

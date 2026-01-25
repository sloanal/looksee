/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  // Prevent unnecessary recompiles by ignoring directories that change but aren't code
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/.npm-cache/**',
        '**/public/uploads/**',
        '**/*.swp',
        '**/*.swo',
        '**/.DS_Store',
      ],
    };
    return config;
  },
}

module.exports = nextConfig


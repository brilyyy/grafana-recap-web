const nextConfig = {
  output: 'standalone',

  experimental: {
    serverComponentsExternalPackages: [
      'pg',
      'node-cron',
      'mysql2',
    ],
  },
}

module.exports = nextConfig


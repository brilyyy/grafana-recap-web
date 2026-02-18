const nextConfig = {
  output: 'standalone',

  experimental: {
    serverComponentsExternalPackages: [
      'pg',
      'node-cron',
      'mysql2',
      'typeorm',
    ],
  },
}

module.exports = nextConfig


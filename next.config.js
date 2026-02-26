const nextConfig = {
  output: 'standalone',

  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'pg',
      'node-cron',
      'mysql2',
    ],
  },
}

module.exports = nextConfig


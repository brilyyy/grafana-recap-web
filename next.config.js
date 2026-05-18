const nextConfig = {
  output: 'standalone',

  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'pg',
      'node-cron',
    ],
  },
}

module.exports = nextConfig


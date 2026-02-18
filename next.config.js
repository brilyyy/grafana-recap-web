// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   output: 'standalone',

//   experimental: {
//     instrumentationHook: true,

//     serverComponentsExternalPackages: [
//       'pg',
//       'node-cron',
//       'mysql2',
//       'typeorm',
//     ],
//   },

//   webpack: (config, { isServer }) => {
//     if (isServer) {
//       config.externals.push({
//         'pg-native': 'commonjs pg-native',
//       })
//     }

//     return config
//   },
// }

// module.exports = nextConfig


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


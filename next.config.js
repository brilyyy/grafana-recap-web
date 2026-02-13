/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['node-cron', 'pg', 'mysql2'],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Exclude node-cron, database drivers, and Node.js built-in modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        net: false,
        tls: false,
        child_process: false,
        stream: false,
        util: false,
        url: false,
        querystring: false,
      }
      
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /node_modules[\\/](pg|pg-connection-string|mysql2|typeorm|node-cron)/,
          message: /Can't resolve '(fs|path|os|crypto|net|tls|child_process|stream|util|url|querystring)'/,
        },
        {
          message: /Can't resolve 'fs'/,
        },
      ]
      
      const emptyModulePath = require.resolve('./src/lib/empty-module.js')
      
      config.resolve.alias = {
        ...config.resolve.alias,
        // External npm packages - MUST be first to catch before resolution
        'pg': emptyModulePath,
        'pg-connection-string': emptyModulePath,
        'node-cron': emptyModulePath,
        'mysql2': emptyModulePath,
        'typeorm': emptyModulePath,
      }
      
      config.plugins = config.plugins || []
      
      // Use NormalModuleReplacementPlugin to replace modules that import server-only code
      // This runs after alias resolution, so we catch any that slip through
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /src[\\/]lib[\\/](scheduler|db|db-factory|adapters[\\/](postgresql|mysql)-adapter)/,
          emptyModulePath
        )
      )
      
      // Ignore server-only packages BEFORE webpack tries to resolve them
      // This must come BEFORE NormalModuleReplacementPlugin to prevent dependency analysis
      config.plugins.unshift(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(node-cron|pg|mysql2|typeorm|pg-connection-string|pg-pool|pg-packet-stream|pg-protocol|pgpass|pg-native)$/,
        }),
        new webpack.IgnorePlugin({
          checkResource(resource, context) {
            // Ignore if resource path contains server-only package names
            const serverOnlyPackages = ['node-cron', 'pg', 'mysql2', 'typeorm', 'pg-connection-string']
            return serverOnlyPackages.some(pkg => 
              resource.includes(pkg) || (context && context.includes(pkg))
            )
          },
        })
      )
      
      // Mark server-only modules as externals to prevent bundling
      const serverOnlyModules = [
        'node-cron',
        'pg',
        'mysql2',
        'typeorm',
        'pg-connection-string',
        'pg-pool',
        'pg-packet-stream',
        'pg-protocol',
        'pgpass',
        'pg-native',
      ]
      
      // Add externals
      if (!config.externals) {
        config.externals = []
      }
      
      // Handle externals - can be array or function
      if (Array.isArray(config.externals)) {
        config.externals.push(...serverOnlyModules)
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals
        config.externals = [
          ...serverOnlyModules,
          originalExternals,
        ]
      } else {
        config.externals = [
          ...serverOnlyModules,
          config.externals,
        ]
      }
    }
    
    return config
  },
}

module.exports = nextConfig


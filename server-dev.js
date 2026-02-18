require('dotenv').config()
process.env.NODE_ENV = 'development'
console.log('🚀 Dev server starting...')

require('ts-node').register({
  transpileOnly: true,
})

require('tsconfig-paths').register()

async function start() {
  const { initializeScheduler } = require('./src/lib/scheduler.ts')
  await initializeScheduler()
  const next = require('next')
  const app = next({ dev: true })
  const handle = app.getRequestHandler()
  await app.prepare()
  require('http')
    .createServer((req, res) => {
      handle(req, res)
    })
    .listen(3000, () => {
      console.log('✅ Dev server ready')
      console.log('http://localhost:3000')
    })
}
start()
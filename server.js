require('dotenv').config()
process.env.NODE_ENV = 'production'
console.log('🚀 Production server starting...')

async function start() {
  const { initializeScheduler } = require('./.next/server/app/lib/scheduler.js')
  await initializeScheduler()
  const next = require('next')
  const app = next({ dev: false })
  const handle = app.getRequestHandler()
  await app.prepare()
  require('http')
    .createServer((req, res) => {
      handle(req, res)
    })
    .listen(3000, () => {
      console.log('✅ Production server ready')
    })
}
start()

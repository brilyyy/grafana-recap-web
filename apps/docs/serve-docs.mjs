import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const PORT = process.env.DOCS_PORT || 8080
const ROOT = path.dirname(fileURLToPath(import.meta.url))

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json',
}

http.createServer((req, res) => {
  let url = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  let file = path.join(ROOT, url)
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return }

  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(file, 'index.html'), (e2, d2) => {
        if (e2) {
          fs.readFile(path.join(ROOT, 'index.html'), (e3, d3) => {
            if (e3) { res.writeHead(404); res.end(); return }
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(d3)
          })
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(d2)
      })
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  })
}).listen(PORT, () => console.log(`Docs: http://localhost:${PORT}`))

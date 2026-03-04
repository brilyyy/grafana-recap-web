#!/usr/bin/env node
/**
 * Copy procedure SQL files from parent project to migration-kit.
 * Run from migration-kit directory: node scripts/copy-procedures.js
 */
const fs = require('fs')
const path = require('path')

const apps = ['bale', 'bale_bisnis', 'olob']
const files = ['procedure.mysql.sql', 'procedure.postgres.sql']

for (const app of apps) {
  for (const f of files) {
    const src = path.join(__dirname, '..', '..', 'scripts', 'success_rate', app, f)
    const dst = path.join(__dirname, 'success_rate', app, f)
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(src, dst)
      console.log('Copied', app, f)
    } else {
      console.warn('Source not found:', src)
    }
  }
}

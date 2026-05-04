'use strict'

/**
 * Post-build deploy bundle (run after `next build --no-lint` with output: "standalone"):
 * 1. Merge project static/ into .next/static (if static/ exists)
 * 2. Merge public/ into .next/standalone/public
 * 3. Copy .next/standalone and migration-kit/ into deploy/deploy-{timestamp}/
 * 4. Zip that folder to deploy/deploy-{timestamp}.zip, then remove the folder
 */

const fs = require('fs')
const path = require('path')
const { execFileSync, spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')

function timestampFolderName() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

/** Recursive copy; skips directory names node_modules and .git at any depth */
function copyDirFiltered(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue
    const from = path.join(src, ent.name)
    const to = path.join(dest, ent.name)
    if (ent.isDirectory()) copyDirFiltered(from, to)
    else fs.copyFileSync(from, to)
  }
}

function createZip(bundlePath, zipPath) {
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true })

  if (process.platform === 'win32') {
    const lit = (p) => p.replace(/'/g, "''")
    const ps = `Compress-Archive -LiteralPath '${lit(bundlePath)}' -DestinationPath '${lit(zipPath)}' -Force`
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' })
    return
  }

  const deployDir = path.dirname(bundlePath)
  const baseName = path.basename(bundlePath)
  const r = spawnSync('zip', ['-r', zipPath, baseName], { cwd: deployDir, stdio: 'inherit' })
  if (r.status === 0) return

  const py = [
    '-c',
    'import shutil, sys\n' +
      `shutil.make_archive(${JSON.stringify(path.join(deployDir, baseName))}, 'zip', ${JSON.stringify(deployDir)}, ${JSON.stringify(baseName)})\n`,
  ]
  const r2 = spawnSync('python3', py, { stdio: 'inherit' })
  if (r2.status === 0) return
  const r3 = spawnSync('py', ['-3', ...py], { stdio: 'inherit' })
  if (r3.status !== 0) {
    console.error('Could not create zip: install `zip`, or Python 3 (`python3` / `py -3`).')
    process.exit(1)
  }
}

function main() {
  const standaloneDir = path.join(root, '.next', 'standalone')
  if (!fs.existsSync(standaloneDir)) {
    console.error('Missing .next/standalone. Run a production build first (next.config: output: "standalone").')
    process.exit(1)
  }

  const staticSrc = path.join(root, 'static')
  const nextStatic = path.join(root, '.next', 'static')
  if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(nextStatic, { recursive: true })
    fs.cpSync(staticSrc, nextStatic, { recursive: true })
    console.log('Copied static/ -> .next/static')
  } else {
    console.warn('No static/ at project root; skipped copy to .next/static')
  }

  const publicSrc = path.join(root, 'public')
  const publicDest = path.join(standaloneDir, 'public')
  if (fs.existsSync(publicSrc)) {
    fs.mkdirSync(publicDest, { recursive: true })
    fs.cpSync(publicSrc, publicDest, { recursive: true })
    console.log('Copied public/ -> .next/standalone/public')
  } else {
    console.warn('No public/ at project root; skipped copy to .next/standalone/public')
  }

  const standaloneNextStatic = path.join(standaloneDir, '.next', 'static')
  if (fs.existsSync(nextStatic)) {
    fs.mkdirSync(path.dirname(standaloneNextStatic), { recursive: true })
    fs.cpSync(nextStatic, standaloneNextStatic, { recursive: true })
    console.log('Synced .next/static -> .next/standalone/.next/static')
  }

  const migrationSrc = path.join(root, 'migration-kit')
  if (!fs.existsSync(migrationSrc)) {
    console.error('Missing migration-kit/ directory.')
    process.exit(1)
  }

  const deployDir = path.join(root, 'deploy')
  fs.mkdirSync(deployDir, { recursive: true })
  const folderName = `deploy-${timestampFolderName()}`
  const bundlePath = path.join(deployDir, folderName)
  fs.mkdirSync(bundlePath, { recursive: true })

  const outStandalone = path.join(bundlePath, 'standalone')
  fs.cpSync(standaloneDir, outStandalone, { recursive: true })
  console.log('Copied .next/standalone -> deploy/' + folderName + '/standalone')

  const outMk = path.join(bundlePath, 'migration-kit')
  copyDirFiltered(migrationSrc, outMk)
  console.log('Copied migration-kit/ -> deploy/' + folderName + '/migration-kit (excl. node_modules, .git)')

  const zipPath = path.join(deployDir, `${folderName}.zip`)
  createZip(bundlePath, zipPath)

  if (!fs.existsSync(zipPath)) {
    console.error('Zip was not created:', zipPath)
    process.exit(1)
  }

  fs.rmSync(bundlePath, { recursive: true, force: true })
  console.log('Removed intermediate folder:', bundlePath)
  console.log('Done:', zipPath)
}

main()

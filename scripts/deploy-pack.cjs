'use strict'

/**
 * Post-build deploy bundle (run after `npm run build -- --no-lint`; next.config uses output: "standalone"):
 * 1. Merge project static assets into .next/static (see resolveStaticSource())
 * 2. Merge public/ into .next/standalone/public
 * 3. Copy .next/standalone and migration-kit/ into deploy/deploy-{timestamp}/
 * 4. Zip that folder to deploy/deploy-{timestamp}.zip, then remove the folder
 *
 * Windows: zip is created from a staging copy under %TEMP% using .NET ZipFile.
 * This avoids OneDrive/file-lock issues seen when zipping directly from workspace.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync, spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')

function timestampFolderName() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

function sleepMs(ms) {
  if (ms <= 0) return
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`], {
      stdio: 'pipe',
    })
  } catch {
    const end = Date.now() + ms
    while (Date.now() < end) {}
  }
}

/** First existing directory among common static locations (repo root). */
function resolveStaticSource(nextStaticDir) {
  const fromEnv = process.env.STATIC_DEPLOY_SOURCE
  const candidates = [
    fromEnv && path.isAbsolute(fromEnv) ? fromEnv : fromEnv ? path.join(root, fromEnv) : null,
    path.join(root, 'static'),
    path.join(root, 'Static'),
    path.join(root, '@static'),
    path.join(root, 'public', 'static'),
    nextStaticDir,
  ].filter(Boolean)

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir
    } catch {
      /* ignore */
    }
  }
  return null
}

/** Recursive copy; skips .git directories at any depth */
function copyDirFiltered(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === '.git') continue
    const from = path.join(src, ent.name)
    const to = path.join(dest, ent.name)
    if (ent.isDirectory()) copyDirFiltered(from, to)
    else fs.copyFileSync(from, to)
  }
}

function zipWithDotNetZipFile(sourceDir, zipPath) {
  const lit = (p) => p.replace(/'/g, "''")
  const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath '${lit(zipPath)}') { Remove-Item -LiteralPath '${lit(zipPath)}' -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory('${lit(sourceDir)}', '${lit(zipPath)}', [System.IO.Compression.CompressionLevel]::Optimal, $true)
`
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' })
    return fs.existsSync(zipPath)
  } catch {
    return false
  }
}

function createZip(bundlePath, zipPath) {
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true })

  // Windows / OneDrive: always zip from a copy under %TEMP% (usually not cloud-synced).
  if (process.platform === 'win32') {
    const baseName = path.basename(bundlePath)
    const stageParent = path.join(os.tmpdir(), `dashboard-grafana-deploy-${Date.now()}`)
    const stageDir = path.join(stageParent, baseName)
    fs.mkdirSync(stageParent, { recursive: true })
    try {
      fs.cpSync(bundlePath, stageDir, { recursive: true })
      sleepMs(700)
      for (let i = 0; i < 4; i++) {
        if (zipWithDotNetZipFile(stageDir, zipPath)) return
        sleepMs(1500)
      }
    } finally {
      try {
        fs.rmSync(stageParent, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
    console.error('Could not create zip:', zipPath)
    console.error('Try closing editors/antivirus scans and retry.')
    process.exit(1)
  }

  const zipParent = path.dirname(bundlePath)
  const zipBase = path.basename(bundlePath)
  const r = spawnSync('zip', ['-r', zipPath, zipBase], { cwd: zipParent, stdio: 'inherit' })
  if (r.status === 0 && fs.existsSync(zipPath)) return
  const py =
    'import shutil\n' +
    `shutil.make_archive(${JSON.stringify(path.join(zipParent, zipBase))}, 'zip', ${JSON.stringify(zipParent)}, ${JSON.stringify(zipBase)})\n`
  const r2 = spawnSync('python3', ['-c', py], { stdio: 'inherit' })
  if (r2.status === 0 && fs.existsSync(zipPath)) return
  const r3 = spawnSync('py', ['-3', '-c', py], { stdio: 'inherit' })
  if (r3.status === 0 && fs.existsSync(zipPath)) return
  console.error('Could not create zip:', zipPath)
  process.exit(1)
}

function main() {
  const standaloneDir = path.join(root, '.next', 'standalone')
  if (!fs.existsSync(standaloneDir)) {
    console.error('Missing .next/standalone. Run a production build first (next.config: output: "standalone").')
    process.exit(1)
  }

  const nextStatic = path.join(root, '.next', 'static')
  const staticSrc = resolveStaticSource(nextStatic)
  if (staticSrc) {
    if (path.resolve(staticSrc) === path.resolve(nextStatic)) {
      console.log('Using existing .next/static as static source')
    } else {
      fs.mkdirSync(nextStatic, { recursive: true })
      fs.cpSync(staticSrc, nextStatic, { recursive: true })
      console.log('Copied', path.relative(root, staticSrc), '-> .next/static')
    }
  } else {
    console.warn(
      'No static folder found (tried: STATIC_DEPLOY_SOURCE, static/, Static/, @static/, public/static/, .next/static/).',
    )
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
  console.log('Copied migration-kit/ -> deploy/' + folderName + '/migration-kit (excl. .git)')

  const zipPath = path.join(deployDir, `${folderName}.zip`)
  sleepMs(300)
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

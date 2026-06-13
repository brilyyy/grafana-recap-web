# Server Installation

Complete walkthrough for deploying grafana-recap-web to a fresh Ubuntu/Debian server with systemd process management, nginx reverse proxy, and Let's Encrypt TLS.

> **Note:** For a quick local dev setup see the [Project README](../../README.md). This guide covers a full production install only.

---

## Architecture at a glance

```
Internet
   │  HTTPS :443
   ▼
 nginx  ──────────── TLS termination (certbot / Let's Encrypt)
   │  HTTP proxy
   ▼
 Node.js  ─── dist/server/server.js  (main HTTP server)
               └── auto-forks ──►  dist/server/workers/scheduler-worker.mjs
                                    (node-cron scheduler, same env, child PID)
   │
   ▼
 PostgreSQL 14+
   ├── platform_db          (main app DB)
   └── <source_dbs>         (raw app DBs, accessed via postgres_fdw)
```

**One systemd service** runs the Node process. The scheduler worker is forked automatically on first boot — **do not start it separately**.

---

## 1. Prerequisites

### System packages

```bash
# Update and install build essentials + git + nginx + certbot
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential nginx certbot python3-certbot-nginx
```

### Node.js 20.x (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # expect v20.x.x
```

### pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v   # verify
```

> **Note:** `corepack` is bundled with Node 20. As an alternative: `npm install -g pnpm`.

### PostgreSQL 14+

```bash
sudo apt install -y postgresql postgresql-contrib

# postgres_fdw is included in postgresql-contrib — verify:
sudo -u postgres psql -c "SELECT * FROM pg_available_extensions WHERE name = 'postgres_fdw';"
```

---

## 2. PostgreSQL setup

### Create the app database and role

```sql
-- Run as postgres superuser: sudo -u postgres psql

CREATE ROLE recap_user WITH LOGIN PASSWORD 'strong_password_here';
CREATE DATABASE platform_db OWNER recap_user;

-- The migration phase that creates postgres_fdw (and foreign servers, mappings)
-- requires CREATE EXTENSION privilege. Simplest: grant superuser temporarily,
-- revoke after first migration run. Or grant only the extension:
ALTER ROLE recap_user SUPERUSER;
-- (revoke after first successful migration: ALTER ROLE recap_user NOSUPERUSER;)
```

### Allow app to connect

Edit `/etc/postgresql/<version>/main/pg_hba.conf` — ensure a `md5` or `scram-sha-256` line for `recap_user` on `platform_db`:

```
# TYPE  DATABASE       USER         ADDRESS        METHOD
local   platform_db    recap_user                  scram-sha-256
host    platform_db    recap_user   127.0.0.1/32   scram-sha-256
```

```bash
sudo systemctl reload postgresql
```

> **Note:** If source DBs (raw app data) live on the same Postgres instance they need to be reachable by `recap_user` as well (same host/port/credentials). The FDW migration uses `DB_HOST`/`DB_USER`/`DB_PASSWORD` to create user mappings. See [Server Config](../technical/server-config.md) for full FDW details.

---

## 3. Get the code and install dependencies

```bash
# Create a dedicated system user (no login shell, no home needed)
sudo useradd --system --no-create-home --shell /usr/sbin/nologin recap

# Clone to a persistent location
sudo mkdir -p /opt/grafana-recap-web
sudo chown recap:recap /opt/grafana-recap-web
sudo -u recap git clone <repo-url> /opt/grafana-recap-web
cd /opt/grafana-recap-web

# Install dependencies (frozen lockfile for reproducible production installs)
sudo -u recap pnpm install --frozen-lockfile
```

> **Note:** `@node-rs/argon2` is a native add-on. `pnpm install` downloads a prebuilt binary for Linux x64 — no compiler step needed on standard servers. If it fails, verify `build-essential` is installed and retry.

---

## 4. Configure environment

```bash
sudo -u recap cp .env.example /opt/grafana-recap-web/.env
sudo -u recap nano /opt/grafana-recap-web/.env
```

Populate `.env` with the values below. Required vars are validated at startup — the app will **throw and refuse to start** if any are missing.

```env
# ─── Required ──────────────────────────────────────────────────────────────────
NODE_ENV=production

# PostgreSQL connection (platform_db)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=recap_user
DB_PASSWORD=strong_password_here
DB_NAME=platform_db

# DB_TYPE is read outside the schema validator — set it explicitly
DB_TYPE=postgres

# Auth (required — NOT in .env.example, must be added manually)
BETTER_AUTH_SECRET=<output of: openssl rand -base64 48>
BETTER_AUTH_URL=https://your.domain.com

# ─── Optional: first superadmin seeding ────────────────────────────────────────
# Set before first migration run; remove or leave blank after seeding.
DEFAULT_SU_USERNAME=admin
DEFAULT_SU_PASSWORD=changeme123     # min 8 chars
DEFAULT_SU_EMAIL=admin@your.domain.com

# ─── Optional: FDW source-DB grants ───────────────────────────────────────────
# DB_USER_TARGET=recap_user        # grant USAGE on foreign servers to this user

# ─── Optional: trusted origins (if app is behind a load balancer / CDN) ───────
# BETTER_AUTH_TRUSTED_ORIGINS=https://your.domain.com,https://www.your.domain.com

# ─── Optional: external trigger API key ───────────────────────────────────────
# RECAP_TRIGGER_API_KEY=some_secret_api_key

# ─── Optional: FDW source databases list (used by migration) ──────────────────
# TARGET_DATABASES=platform_db,bale_db,cms_db

# ─── Optional: scheduler timezone (default: Asia/Jakarta) ─────────────────────
SCHEDULER_TIMEZONE=Asia/Jakarta

# ─── Optional: per-app cron schedules (default: 1 0 * * * = 00:01 daily) ──────
BALE_PROCESSING_SCHEDULE=1 0 * * *
BALE_BISNIS_PROCESSING_SCHEDULE=1 0 * * *
OLOB_PROCESSING_SCHEDULE=1 0 * * *
EDC_AGEN_PROCESSING_SCHEDULE=1 0 * * *
EDC_MERCHANT_PROCESSING_SCHEDULE=1 0 * * *
EDC_MERCHANT_ANCOL_PROCESSING_SCHEDULE=1 0 * * *
CMS_PROCESSING_SCHEDULE=1 0 * * *
BALE_KORPORA_PROCESSING_SCHEDULE=1 0 * * *
CMS_CORP_RECAP_SCHEDULE=1 0 * * *
BALE_KORPORA_CORP_RECAP_SCHEDULE=1 0 * * *

# ─── Optional: housekeeping cron (default: 0 2 * * * = 02:00 daily) ───────────
HOUSEKEEPING_SCHEDULE=0 2 * * *
```

Generate `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 48
```

Secure the file — it contains database and auth secrets:

```bash
sudo chmod 600 /opt/grafana-recap-web/.env
sudo chown recap:recap /opt/grafana-recap-web/.env
```

> **Warning:** Never set `SKIP_ENV_VALIDATION=true` in production. It bypasses startup validation and allows the app to boot with broken config.

---

## 5. Run database migrations

The migration runner (`src/db/migrate.ts`) is called via `tsx` and reads the same `DB_*` env vars. Run it as the app user so `.env` is loaded:

```bash
cd /opt/grafana-recap-web

# Full migration — runs all phases:
#   Phase 1  core schema (app_identifier, fdw_source_table, app_processing_log, …)
#   Phase 2  better-auth tables (user, session, account, …)
#   Phase 3  recap model tables + indexes
#   Phase 4b FDW setup (CREATE EXTENSION postgres_fdw, foreign servers, mappings)
#   Phase 5  stored procedures (sp_process_*_daily, sp_recap_*_daily, housekeeping)
#   Phase 6  superadmin seed (if DEFAULT_SU_* are set)
#   Phase 8  scheduler_jobs table + seed rows
sudo -u recap pnpm db:migrate
```

> **Warning:** Phase 4b (`CREATE EXTENSION postgres_fdw`) requires superuser or `CREATE EXTENSION` privilege. If it fails with `permission denied`, grant superuser temporarily (see step 2), re-run, then revoke.

**Verify the migration succeeded:**

```bash
sudo -u postgres psql -d platform_db -c "\dt public.*" | grep -E "app_identifier|fdw_source|scheduler_jobs"
sudo -u postgres psql -d platform_db -c "SELECT extname FROM pg_extension WHERE extname = 'postgres_fdw';"
```

### Targeted migration phases (for reruns)

| Command | Runs |
|---------|------|
| `pnpm db:migrate:schema` | Core schema + better-auth + indexes only |
| `pnpm db:migrate:procedures` | Stored procedures only |
| `pnpm db:migrate:seed` | Superadmin seed only |
| `pnpm db:migrate:fdw` | FDW servers / foreign tables only (use after editing `fdw_source_table` in the UI) |

All phases are **idempotent** — safe to re-run.

---

## 6. First superadmin

**Path A — seed via migration (recommended for unattended installs):**

Set `DEFAULT_SU_USERNAME`, `DEFAULT_SU_PASSWORD` (≥ 8 chars), and optionally `DEFAULT_SU_EMAIL` in `.env` before running `pnpm db:migrate` (step 5). The seed phase creates a user with role `superadmin`. After first login, remove or blank out the `DEFAULT_SU_*` vars.

```bash
# Re-seed without running the full migration:
sudo -u recap pnpm db:seed-superadmin
```

**Path B — first web registration:**

If `DEFAULT_SU_*` are not set, open `https://your.domain.com/register` after the server is running. The **first registration** becomes an `admin` user (not superadmin). All subsequent registrations queue for approval. You can promote the admin to superadmin via the database:

```sql
UPDATE "user" SET role = 'superadmin' WHERE email = 'your@email.com';
```

---

## 7. Build

```bash
cd /opt/grafana-recap-web
sudo -u recap pnpm build
```

This runs `vite build && pnpm run build:worker` — both commands must complete.

Confirm the two critical output files exist:

```bash
ls -lh dist/server/server.js                        # main server entry (~179 KB)
ls -lh dist/server/workers/scheduler-worker.mjs     # scheduler worker bundle
```

> **Warning:** The `package.json` `start` script (`node .output/server/index.mjs`) points at a path that **does not exist** after a Vite build. Use the correct command below — do not use `pnpm start`.

Correct production start command:

```bash
node /opt/grafana-recap-web/dist/server/server.js
```

---

## 8. Run under systemd

### Create the unit file

```bash
sudo nano /etc/systemd/system/grafana-recap.service
```

```ini
[Unit]
Description=Grafana Recap Web App
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=recap
Group=recap
WorkingDirectory=/opt/grafana-recap-web
EnvironmentFile=/opt/grafana-recap-web/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=grafana-recap

# Prevent privilege escalation
NoNewPrivileges=yes
ProtectSystem=full
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

### Enable and start

```bash
sudo systemctl daemon-reload
sudo systemctl enable grafana-recap
sudo systemctl start grafana-recap
sudo systemctl status grafana-recap
```

### Verify worker started

```bash
journalctl -u grafana-recap -f
# Look for: [server] Scheduler worker ready (pid=…, jobs=…)
```

The scheduler worker runs as a **child process of this service** — it is forked automatically by `dist/server/server.js` on boot. It self-restarts up to 5 times on crash. You do not need a separate systemd unit for it.

### Confirm listening port

```bash
ss -ltnp | grep node
# Example output: LISTEN 0 511 0.0.0.0:3000  users:(("node",pid=…))
```

The default port is **3000**. Override with `PORT=<n>` in `.env` if needed.

---

## 9. nginx reverse proxy + TLS

### nginx site config

```bash
sudo nano /etc/nginx/sites-available/grafana-recap
```

Replace `your.domain.com` and `3000` (if you changed `PORT`):

```nginx
upstream grafana_recap {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your.domain.com;

    # certbot will add the HTTPS redirect block here

    location / {
        proxy_pass http://grafana_recap;
        proxy_http_version 1.1;

        # WebSocket support (TanStack Start uses WS for HMR in dev; keep for prod too)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;

        # Large uploads (Excel files via /uploads)
        client_max_body_size 50M;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/grafana-recap /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### TLS via certbot

```bash
sudo certbot --nginx -d your.domain.com
# Follow prompts; certbot edits the nginx config and adds auto-renewal
```

### Update BETTER_AUTH_URL

Once TLS is live, ensure `.env` has the `https` URL:

```env
BETTER_AUTH_URL=https://your.domain.com
```

This is required for **secure cookies** — better-auth enables `secure: true` automatically when the URL starts with `https`. Restart the service after changing `.env`:

```bash
sudo systemctl restart grafana-recap
```

If you access the app from additional origins (load balancer, internal alias), add them:

```env
BETTER_AUTH_TRUSTED_ORIGINS=https://your.domain.com,https://internal.alias
```

---

## 10. Smoke test

```bash
# 1. Service running
sudo systemctl is-active grafana-recap       # active

# 2. Node listening
ss -ltnp | grep node                         # port 3000 (or PORT)

# 3. HTTP response via nginx
curl -I https://your.domain.com              # HTTP/2 200

# 4. Scheduler worker
journalctl -u grafana-recap --no-pager | grep "Scheduler worker ready"

# 5. Log in as superadmin → Superadmin > Jobs
#    Should show seeded scheduler jobs (sp_process_*_daily, housekeeping, etc.)
```

---

## 11. Upgrades

```bash
cd /opt/grafana-recap-web

# Pull latest code
sudo -u recap git pull

# Install any new/updated deps
sudo -u recap pnpm install --frozen-lockfile

# Apply schema/procedure changes (idempotent — safe to always run)
sudo -u recap pnpm db:migrate

# Rebuild client + worker bundles
sudo -u recap pnpm build

# Restart the service (picks up new dist/server/server.js + worker)
sudo systemctl restart grafana-recap
sudo systemctl status grafana-recap
```

### Logs

```bash
journalctl -u grafana-recap -n 100 --no-pager
journalctl -u grafana-recap -f                 # live tail
```

### Database backups

```bash
# Full dump
sudo -u postgres pg_dump platform_db | gzip > platform_db_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c platform_db_20260101.sql.gz | sudo -u postgres psql platform_db
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Error: Missing required env var: BETTER_AUTH_SECRET` | `.env` not loaded or var missing | Check `EnvironmentFile=` path in unit; verify var is present |
| `Error [ERR_DLOPEN_FAILED]: argon2` | Wrong native binary (arch/glibc mismatch) | `sudo -u recap pnpm install --frozen-lockfile` on the **target server**, not a dev machine |
| `ERROR: permission denied to create extension "postgres_fdw"` | DB role lacks `CREATE EXTENSION` | Grant superuser for migration (step 2), re-run, then revoke |
| FDW phase fails: `could not connect to server` | Source DB unreachable from Postgres | Verify `DB_HOST`/port reachability; check `pg_hba.conf` on source DB |
| `[server] Restarting scheduler worker in Xms (attempt N/5)` | Worker crash-loop | `journalctl -u grafana-recap` for the worker's stderr; likely a DB connection issue |
| `502 Bad Gateway` (nginx) | App not listening on expected port | `ss -ltnp | grep node` to find actual port; update `upstream` block |
| Cookies not persisting after TLS | `BETTER_AUTH_URL` still `http://` | Set `BETTER_AUTH_URL=https://…` and restart service |
| `pnpm start` fails / `.output` not found | Stale `package.json` script | Use `node dist/server/server.js` directly (see systemd unit) |

---

## Installation walkthrough checklist

| # | Step | Command / Location | Done |
|---|------|--------------------|------|
| 1 | Install Node 20.x, pnpm, build tools, git, nginx, certbot | `apt install …` + NodeSource | ☐ |
| 2 | Install PostgreSQL 14+ with `postgres_fdw` | `apt install postgresql postgresql-contrib` | ☐ |
| 3 | Create `recap_user` role + `platform_db` database | `sudo -u postgres psql` | ☐ |
| 4 | Grant `SUPERUSER` to `recap_user` (for FDW extension) | `ALTER ROLE recap_user SUPERUSER;` | ☐ |
| 5 | Create system user `recap` | `useradd --system …` | ☐ |
| 6 | Clone repo to `/opt/grafana-recap-web` | `git clone <repo>` | ☐ |
| 7 | `pnpm install --frozen-lockfile` | `sudo -u recap pnpm install …` | ☐ |
| 8 | Copy `.env.example` → `.env`; populate all required vars | `nano .env` | ☐ |
| 9 | Generate `BETTER_AUTH_SECRET` | `openssl rand -base64 48` | ☐ |
| 10 | Set `BETTER_AUTH_URL=https://your.domain.com` | `.env` | ☐ |
| 11 | Set `DEFAULT_SU_USERNAME/PASSWORD/EMAIL` for seeding | `.env` | ☐ |
| 12 | `chmod 600 .env` | `chmod 600 /opt/grafana-recap-web/.env` | ☐ |
| 13 | Run full migration | `sudo -u recap pnpm db:migrate` | ☐ |
| 14 | Verify tables + `postgres_fdw` extension | `psql -d platform_db -c "\dt"` | ☐ |
| 15 | Revoke superuser from `recap_user` (optional hardening) | `ALTER ROLE recap_user NOSUPERUSER;` | ☐ |
| 16 | Build the app | `sudo -u recap pnpm build` | ☐ |
| 17 | Confirm `dist/server/server.js` + `scheduler-worker.mjs` exist | `ls dist/server/` | ☐ |
| 18 | Create `/etc/systemd/system/grafana-recap.service` | See section 8 | ☐ |
| 19 | `systemctl enable --now grafana-recap` | `systemctl enable --now grafana-recap` | ☐ |
| 20 | Confirm worker ready in logs | `journalctl -u grafana-recap -f` | ☐ |
| 21 | Confirm Node listening port | `ss -ltnp \| grep node` | ☐ |
| 22 | Create nginx site config; `nginx -t && reload` | `/etc/nginx/sites-available/grafana-recap` | ☐ |
| 23 | Run `certbot --nginx -d your.domain.com` | `certbot --nginx …` | ☐ |
| 24 | `curl -I https://your.domain.com` → HTTP 200 | Terminal | ☐ |
| 25 | Log in as superadmin; verify Superadmin → Jobs are populated | Browser | ☐ |
| 26 | Remove `DEFAULT_SU_*` from `.env`; restart service | `.env` → `systemctl restart grafana-recap` | ☐ |

---

## Related Docs

- [Operations Index](./README.md)
- [Server Configuration Guide](../technical/server-config.md) — PostgreSQL requirements, FDW depth, stored procedures
- [Add a New Application](./add-new-app.md) — register apps, success-rate queries, stored procedures post-install
- [Technical Docs Index](../README.md)
- [Project README](../../README.md)

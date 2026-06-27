---
title: Server Installation
description: Full production deployment walkthrough.
---

Complete walkthrough for deploying grafana-recap-web to a fresh Ubuntu/Debian server with systemd process management, nginx reverse proxy, and Let's Encrypt TLS.

> **Note:** For a quick local dev setup see the project README. This guide covers a full production install only.

## Architecture at a Glance

```
Internet
   |  HTTPS :443
   v
 nginx  ------------ TLS termination (certbot / Let's Encrypt)
   |  HTTP proxy
   v
 Node.js  --- dist/server/server.js  (main HTTP server)
               +--- auto-forks --->  dist/server/workers/scheduler-worker.mjs
                                    (node-cron scheduler, same env, child PID)
   |
   v
 PostgreSQL 14+
   +-- platform_db          (main app DB)
   +-- <source_dbs>         (raw app DBs, accessed via postgres_fdw)
```

**One systemd service** runs the Node process. The scheduler worker is forked automatically on first boot — **do not start it separately**.

## 1. Prerequisites

### System packages

```bash
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

### PostgreSQL 14+

```bash
sudo apt install -y postgresql postgresql-contrib
```

## 2. PostgreSQL Setup

### Create the app database and role

```sql
CREATE ROLE recap_user WITH LOGIN PASSWORD 'strong_password_here';
CREATE DATABASE platform_db OWNER recap_user;
ALTER ROLE recap_user SUPERUSER;
-- revoke after first successful migration: ALTER ROLE recap_user NOSUPERUSER;
```

### Allow app to connect

Edit `/etc/postgresql/<version>/main/pg_hba.conf`:

```
# TYPE  DATABASE       USER         ADDRESS        METHOD
local   platform_db    recap_user                  scram-sha-256
host    platform_db    recap_user   127.0.0.1/32   scram-sha-256
```

```bash
sudo systemctl reload postgresql
```

## 3. Get the Code

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin recap
sudo mkdir -p /opt/grafana-recap-web
sudo chown recap:recap /opt/grafana-recap-web
sudo -u recap git clone <repo-url> /opt/grafana-recap-web
cd /opt/grafana-recap-web
sudo -u recap pnpm install --frozen-lockfile
```

## 4. Configure Environment

```bash
sudo -u recap cp .env.example /opt/grafana-recap-web/.env
sudo -u recap nano /opt/grafana-recap-web/.env
```

Required env vars:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=...
DB_NAME=platform_db

BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://your-host
```

## 5. Database Migration

```bash
sudo -u recap pnpm db:migrate
```

## 6. Build

```bash
sudo -u recap pnpm build
```

## 7. Systemd Service

```bash
sudo nano /etc/systemd/system/grafana-recap-web.service
```

```ini
[Unit]
Description=Grafana Recap Web
After=network.target postgresql.service

[Service]
Type=simple
User=recap
WorkingDirectory=/opt/grafana-recap-web
ExecStart=/usr/bin/node dist/server/server.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/grafana-recap-web/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable grafana-recap-web
sudo systemctl start grafana-recap-web
```

## 8. Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/grafana-recap-web
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/grafana-recap-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. TLS

```bash
sudo certbot --nginx -d your-domain.com
```

## Related Docs

- [Technical: Server Config](/technical/server-config)
- [Technical: Processing Scheduler](/technical/processing-scheduler)

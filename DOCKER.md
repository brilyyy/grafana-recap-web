# Docker Setup Guide

Panduan untuk menjalankan aplikasi Dashboard Grafana menggunakan Docker.

## 📋 Prerequisites

- Docker Desktop atau Docker Engine terinstall
- Docker Compose terinstall (biasanya sudah termasuk dengan Docker Desktop)

## 🚀 Quick Start

### 1. Setup Environment Variables

Buat file `.env` di root directory dengan konfigurasi berikut:

```env
# Database Configuration (PostgreSQL)
DB_TYPE=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USER=grafana_user
DB_PASSWORD=grafana_password
DB_NAME=grafana_dashboard

# Application Configuration
APP_PORT=3000

# Node Environment
NODE_ENV=production

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000
```

### 2. Build dan Run dengan Docker Compose

```bash
# Build dan start semua services
docker-compose up -d

# Atau dengan build
docker-compose up -d --build
```

### 3. Akses Aplikasi

- **Aplikasi**: http://localhost:3000
- **PostgreSQL (Docker)**: localhost:5432

## 📝 Docker Commands

### Build Image
```bash
docker-compose build
```

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Stop dan Hapus Volumes (Data akan hilang!)
```bash
docker-compose down -v
```

### View Logs
```bash
# Semua services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

### Restart Service
```bash
docker-compose restart app
docker-compose restart postgres
```

### Execute Commands di Container
```bash
# Masuk ke container app
docker-compose exec app sh

# Masuk ke PostgreSQL
docker-compose exec postgres psql -U grafana_user -d grafana_dashboard
```

## 🔧 Development Mode

Untuk development, gunakan PostgreSQL dari Docker tapi jalankan Next.js secara lokal:

```bash
# Start hanya PostgreSQL
docker-compose -f docker-compose.dev.yml up -d

# Setup .env.local untuk development
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=grafana_user
DB_PASSWORD=grafana_password
DB_NAME=grafana_dashboard

# Run Next.js secara lokal
npm install
npm run dev
```

## 🏗️ Build Standalone

Jika ingin build image secara manual:

```bash
# Build image
docker build -t dashboard-grafana:latest .

# Run container
docker run -p 3000:3000 \
  -e DB_TYPE=postgres \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USER=grafana_user \
  -e DB_PASSWORD=grafana_password \
  -e DB_NAME=grafana_dashboard \
  dashboard-grafana:latest
```

## 📊 Database Management

### Backup Database
```bash
docker-compose exec postgres pg_dump -U grafana_user grafana_dashboard > backup.sql
```

### Restore Database
```bash
docker-compose exec -T postgres psql -U grafana_user -d grafana_dashboard < backup.sql
```

### Reset Database (Hapus semua data)
```bash
docker-compose down -v
docker-compose up -d
```

Atau gunakan fitur "Restart Database" di aplikasi.

## 🐛 Troubleshooting

### Port Already in Use
Jika port 3000 atau 5432 sudah digunakan, ubah di `.env`:
```env
APP_PORT=3001
DB_PORT=5433
```

### Database Connection Error
1. Pastikan PostgreSQL container sudah running: `docker-compose ps`
2. Cek logs PostgreSQL: `docker-compose logs postgres`
3. Pastikan environment variables di `.env` sudah benar
4. Tunggu beberapa detik setelah PostgreSQL start (healthcheck)

### Build Error
1. Hapus cache: `docker-compose build --no-cache`
2. Pastikan semua file sudah ada (package.json, dll)
3. Cek disk space: `docker system df`

### Permission Error (Linux/Mac)
Jika ada permission error untuk uploads folder:
```bash
sudo chown -R $USER:$USER public/uploads
```

## 📦 Docker Images

- **Base Image**: node:18-alpine (lightweight)
- **Multi-stage Build**: Optimized untuk production
- **Non-root User**: Security best practice
- **PostgreSQL**: Official postgres:16-alpine image with pg_cron extension

## 🔒 Security Notes

1. **Jangan commit file `.env`** ke repository
2. Gunakan strong password untuk production
3. Update `.dockerignore` jika ada file sensitif
4. Review environment variables sebelum deploy

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [pg_cron Extension](https://github.com/citusdata/pg_cron)

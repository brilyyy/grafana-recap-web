# Docker Setup Guide

Panduan untuk menjalankan aplikasi Dashboard Grafana menggunakan Docker.

> **Note:** MySQL is deprecated. Use PostgreSQL + pg_cron instead. See [SERVER_CONFIG.md](SERVER_CONFIG.md).

## 📋 Prerequisites

- Docker Desktop atau Docker Engine terinstall
- Docker Compose terinstall (biasanya sudah termasuk dengan Docker Desktop)

## 🚀 Quick Start

### 1. Setup Environment Variables

Buat file `.env` di root directory dengan konfigurasi berikut:

```env
# Database Configuration
# Note: DB_PORT adalah port HOST (default 3307 untuk menghindari konflik dengan MySQL lokal)
# Di dalam container, MySQL tetap berjalan di port 3306
DB_HOST=mysql
DB_PORT=3307
DB_USER=grafana_user
DB_PASSWORD=grafana_password
DB_NAME=grafana_dashboard
DB_ROOT_PASSWORD=rootpassword

# Application Configuration
APP_PORT=3000

# Node Environment
NODE_ENV=production
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
- **MySQL (Docker)**: localhost:3307 (default, untuk menghindari konflik dengan MySQL lokal di port 3306)

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
docker-compose logs -f mysql
```

### Restart Service
```bash
docker-compose restart app
docker-compose restart mysql
```

### Execute Commands di Container
```bash
# Masuk ke container app
docker-compose exec app sh

# Masuk ke MySQL
docker-compose exec mysql mysql -u grafana_user -p grafana_dashboard
```

## 🔧 Development Mode

Untuk development, gunakan MySQL dari Docker tapi jalankan Next.js secara lokal:

```bash
# Start hanya MySQL
docker-compose -f docker-compose.dev.yml up -d

# Setup .env.local untuk development
DB_HOST=localhost
DB_PORT=3307
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
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  -e DB_USER=grafana_user \
  -e DB_PASSWORD=grafana_password \
  -e DB_NAME=grafana_dashboard \
  dashboard-grafana:latest
```

## 📊 Database Management

### Backup Database
```bash
docker-compose exec mysql mysqldump -u grafana_user -p grafana_dashboard > backup.sql
```

### Restore Database
```bash
docker-compose exec -T mysql mysql -u grafana_user -p grafana_dashboard < backup.sql
```

### Reset Database (Hapus semua data)
```bash
docker-compose down -v
docker-compose up -d
```

Atau gunakan fitur "Restart Database" di aplikasi.

## 🐛 Troubleshooting

### Port Already in Use
Jika port 3000 atau 3307 sudah digunakan, ubah di `.env`:
```env
APP_PORT=3001
DB_PORT=3308
```

**Catatan**: Default port MySQL Docker adalah 3307 untuk menghindari konflik dengan MySQL lokal yang biasanya berjalan di port 3306. Jika Anda tidak punya MySQL lokal, Anda bisa mengubah `DB_PORT=3306` di file `.env`.

### Database Connection Error
1. Pastikan MySQL container sudah running: `docker-compose ps`
2. Cek logs MySQL: `docker-compose logs mysql`
3. Pastikan environment variables di `.env` sudah benar
4. Tunggu beberapa detik setelah MySQL start (healthcheck)

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

## 🔒 Security Notes

1. **Jangan commit file `.env`** ke repository
2. Gunakan strong password untuk production
3. Update `.dockerignore` jika ada file sensitif
4. Review environment variables sebelum deploy

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)


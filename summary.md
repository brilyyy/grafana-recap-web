# Ringkasan Analisis Business Logic - Dashboard Grafana

## Overview

Dashboard Grafana adalah aplikasi Next.js (App Router) yang digunakan untuk mengelola data success rate transaksi dari berbagai aplikasi perbankan. Aplikasi ini berfungsi sebagai sistem manajemen data untuk mapping response code (RC), tracking transaksi, dan mengelola dictionary response code untuk setiap aplikasi.

**Tech Stack:**
- Framework: Next.js 14 (App Router) dengan TypeScript
- Database: MySQL (mysql2 dengan connection pooling)
- Styling: Tailwind CSS
- File Processing: xlsx library untuk Excel, custom CSV parser
- State Management: React useState/useEffect (local state) + Custom Events untuk komunikasi antar komponen
- Tidak ada state management global (Redux/Zustand)

## Peta Rute & Fitur Utama

### Struktur Routing (Next.js App Router)

**Single Page Application (SPA):**
- `/` → `src/app/page.tsx` - Dashboard utama dengan semua cards
- Tidak ada routing dinamis atau nested routes

**API Routes:**
- `GET /api/applications` - Daftar aplikasi
- `POST /api/applications` - Tambah aplikasi baru
- `POST /api/upload-dictionary` - Upload file Excel/CSV untuk dictionary RC
- `POST /api/upload-success-rate` - Upload file Excel/CSV untuk data transaksi
- `POST /api/restart-db` - Reset database schema (destructive)
- `GET /api/unmapped-rc` - Daftar RC yang belum dimapping
- `POST /api/unmapped-rc/submit` - Submit mapping RC tunggal
- `POST /api/unmapped-rc/submit-batch` - Submit mapping RC batch
- `GET /api/no-rc-transaction` - Daftar transaksi tanpa RC (paginated)
- `POST /api/no-rc-transaction/submit` - Assign RC ke transaksi tunggal
- `POST /api/no-rc-transaction/submit-batch` - Assign RC ke transaksi batch
- `GET /api/dictionary` - Daftar dictionary entries (dengan filter & pagination)
- `PATCH /api/dictionary/update` - Update error_type dictionary entry
- `PATCH /api/dictionary/update-description` - Update RC description tunggal
- `POST /api/dictionary/update-description-batch` - Update RC description batch
- `GET /api/db-status` - Check database connection status

### Komponen Utama (9 Cards)

1. **AppListCard** - Menampilkan daftar aplikasi terdaftar
2. **AddAppCard** - Form untuk menambah aplikasi baru
3. **DictionaryUploadCard** - Upload file dictionary (Excel/CSV)
4. **AddSuccessRateCard** - Upload file success rate transaksi (Excel/CSV)
5. **RestartDbCard** - Reset database schema (destructive action)
6. **UnmappedRcCard** - Daftar RC yang belum dimapping ke error_type
7. **NoRcTransactionCard** - Daftar transaksi tanpa RC (dengan pagination)
8. **DictionaryCard** - View & edit dictionary entries dengan filter & pagination
9. **ErrorPopup** - Modal untuk menampilkan error rows saat upload gagal
10. **MultiSelectFilter** - Komponen reusable untuk multi-select filter

## ⚠️ UPDATE PENTING (2025-01-27)

**Berdasarkan klarifikasi developer, ada perubahan CRITICAL yang diperlukan:**

1. **Status Transaksi:** Bisa value apapun (tidak ada validasi enum)
2. **Error Type Assignment:** HANYA berdasarkan RC, jenis_transaksi, dan id_app_identifier dari dictionary
3. **Status Transaksi TIDAK mempengaruhi:** RC assignment atau error_type assignment

**Lihat `CODE_CHANGES_REQUIRED.md` untuk detail perubahan code yang diperlukan.**

---

## Business Logic Utama

### 1. Manajemen Aplikasi
- **Tambah Aplikasi**: Validasi nama aplikasi (required, trim, unique), insert ke `app_identifier`
- **Daftar Aplikasi**: Load dari database, auto-refresh saat aplikasi baru ditambahkan (via CustomEvent)

### 2. Upload Dictionary
- **Validasi File**: Format Excel (.xlsx, .xls) atau CSV (.csv), validasi kolom required (Jenis Transaksi, RC, S/N), optional (RC Description)
- **Parsing**: Parse Excel menggunakan xlsx library, parse CSV dengan custom parser yang handle quoted fields
- **Validasi Data**: 
  - S/N harus valid (S, N, Sukses/Success/Berhasil)
  - Skip empty rows
  - Fail upload jika ada row yang di-skip (strict validation)
- **Insert**: INSERT dengan ON DUPLICATE KEY UPDATE untuk handle duplicates
- **Auto-remap**: Setelah upload dictionary, otomatis remap unmapped_rc entries yang sekarang sudah ada di dictionary

### 3. Upload Success Rate
- **Validasi File**: Format Excel/CSV, validasi 7 kolom required + 1 optional
- **Parsing & Validasi**:
  - Tanggal Transaksi: Parse DD/MM/YYYY atau YYYY-MM-DD, extract bulan & tahun
  - Jenis Transaksi: Required, tidak boleh kosong
  - RC: Boleh null (tidak ada auto-assignment berdasarkan status)
  - Status Transaksi: Boleh value apapun, simpan value asli (tidak ada validasi)
- **Error Type Assignment** (HANYA berdasarkan RC dari dictionary):
  - Jika RC ada → Cari di dictionary berdasarkan id_app_identifier, jenis_transaksi, dan RC
  - Jika RC NULL → error_type = NULL (tidak peduli status_transaksi)
  - Jika RC tidak ada di dictionary → Masuk ke unmapped_rc
- **Transaction**: Gunakan database transaction untuk rollback jika ada error

### 4. Unmapped RC Management
- **List**: Filter by application, tampilkan RC yang belum dimapping
- **Submit Mapping**: 
  - Insert ke dictionary
  - Update app_success_rate entries yang match (error_type NULL atau status pending/suspect/cancelled dengan error_type='S')
  - Delete dari unmapped_rc
- **Batch Submit**: Submit multiple mappings sekaligus

### 5. No RC Transaction Management
- **List**: Paginated (25 per page), filter by application, hanya transaksi dengan RC NULL dan error_type IS NULL
- **Assign RC**: Update RC & RC description untuk transaksi tertentu
- **Batch Assign**: Assign RC yang sama ke multiple transaksi

### 6. Dictionary Management
- **View**: Filter by app, error_type, jenis_transaksi, search by RC/description/app
- **Edit Error Type**: Update error_type, juga update app_success_rate entries yang match dengan error_type NULL
- **Edit Description**: Update RC description (tunggal atau batch)
- **Export CSV**: Export filtered data ke CSV dengan BOM untuk Excel compatibility

### 7. Database Restart
- **Destructive Action**: Drop semua tables, recreate schema dengan default apps
- **Warning**: User harus confirm sebelum execute

## State Management & Communication

- **Local State**: Setiap komponen menggunakan useState untuk state lokal
- **Custom Events**: Komunikasi antar komponen via window CustomEvents:
  - `appAdded` - Trigger refresh AppListCard
  - `dictionaryUploaded` - Trigger refresh UnmappedRcCard, NoRcTransactionCard, DictionaryCard
  - `successRateUploaded` - Trigger refresh UnmappedRcCard, NoRcTransactionCard
  - `unmappedRcSubmitted` - Trigger refresh DictionaryCard
  - `noRcTransactionSubmitted` - Trigger refresh DictionaryCard
  - `dictionaryUpdated` - Trigger refresh DictionaryCard

## Database Schema

**Tables:**
1. `app_identifier` - Daftar aplikasi (id, app_name, created_at, updated_at)
2. `app_success_rate` - Data transaksi (id, id_app_identifier, tanggal_transaksi, bulan, tahun, jenis_transaksi, rc, rc_description, total_transaksi, total_nominal, total_biaya_admin, status_transaksi, error_type, created_at, updated_at)
3. `response_code_dictionary` - Mapping RC ke error_type (id, id_app_identifier, jenis_transaksi, rc, rc_description, error_type) dengan UNIQUE constraint (id_app_identifier, jenis_transaksi, rc)
4. `unmapped_rc` - RC yang belum dimapping (id, id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type, created_at) dengan UNIQUE constraint (id_app_identifier, jenis_transaksi, rc)

**Foreign Keys:** Semua tables reference `app_identifier.id` dengan ON DELETE CASCADE

## Environment Variables

**Required:**
- `DB_HOST` - MySQL host
- `DB_PORT` - MySQL port (default: 3306)
- `DB_USER` - MySQL user
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name

## Security & Permission

**Current State:**
- Tidak ada authentication/authorization
- Tidak ada rate limiting
- Tidak ada input sanitization untuk SQL (menggunakan parameterized queries - safe)
- Restart DB tidak ada protection tambahan selain browser confirm

**Risiko:**
- Restart DB bisa diakses siapa saja yang bisa akses aplikasi
- Tidak ada audit log untuk perubahan data
- File upload tidak ada size limit atau virus scanning

## Testing Coverage

**Current State:**
- Tidak ada test files ditemukan
- Tidak ada unit tests
- Tidak ada integration tests
- Tidak ada E2E tests

## Technical Debt & Risiko

1. **State Management**: Menggunakan CustomEvents untuk komunikasi antar komponen - bisa jadi sulit di-debug dan maintain
2. **Error Handling**: Beberapa error handling tidak konsisten, ada yang throw error, ada yang return error response
3. **Type Safety**: Beberapa penggunaan `any` type, terutama di database query results
4. **Code Duplication**: CSV parsing logic duplikat di DictionaryUploadCard dan AddSuccessRateCard
5. **Transaction Management**: Tidak semua operasi database menggunakan transaction (contoh: dictionary update)
6. **Pagination**: Implementasi pagination tidak konsisten (ada yang manual, ada yang via API)
7. **File Upload**: Tidak ada validasi file size, tidak ada progress indicator untuk file besar

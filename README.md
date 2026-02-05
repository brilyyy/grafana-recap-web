# Dashboard Grafana - Dokumentasi Logic Bisnis

## 📋 Daftar Isi

1. [Overview](#overview)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Authentication & Authorization](#authentication--authorization)
4. [User Management](#user-management)
5. [Application Management](#application-management)
6. [Dictionary Management](#dictionary-management)
7. [Success Rate Upload](#success-rate-upload)
8. [Unmapped RC Handling](#unmapped-rc-handling)
9. [No RC Transaction Handling](#no-rc-transaction-handling)
10. [Rate Limiting](#rate-limiting)
11. [Audit Logging](#audit-logging)
12. [Database Schema](#database-schema)

---

## Overview

Dashboard Grafana adalah aplikasi Next.js untuk mengelola data aplikasi, dictionary response code, dan success rate transaksi. Aplikasi ini mendukung multi-database (MySQL dan PostgreSQL) dan memiliki sistem autentikasi berbasis role dengan audit logging.

### Fitur Utama

- **Authentication & Authorization**: Sistem login dengan role-based access control (superadmin, admin, user)
- **User Management**: Pendaftaran user dengan approval system oleh superadmin
- **Application Management**: CRUD untuk aplikasi yang akan dimonitor
- **Dictionary Management**: Upload dan kelola dictionary response code (RC) dengan error type (S/N/Sukses)
- **Success Rate Upload**: Upload data transaksi dengan auto-mapping ke dictionary
- **Unmapped RC Handling**: Manajemen RC yang belum ter-mapping di dictionary
- **No RC Transaction**: Manajemen transaksi yang tidak memiliki RC
- **Rate Limiting**: Proteksi API dari abuse
- **Audit Logging**: Tracking semua aktivitas user

---

## Arsitektur Sistem

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: MySQL / PostgreSQL (multi-database support)
- **ORM**: TypeORM
- **Authentication**: JWT dengan HTTP-only cookies
- **Password Hashing**: bcryptjs (12 rounds)
- **File Processing**: XLSX library untuk Excel, custom parser untuk CSV

### Struktur Direktori

```
src/
├── app/
│   ├── api/              # API routes
│   ├── login/            # Halaman login
│   ├── register/         # Halaman registrasi
│   └── user-approval/     # Halaman approval user (superadmin only)
├── components/           # React components
├── entities/             # TypeORM entities
├── lib/                  # Utility libraries
├── hooks/                # Custom React hooks
└── types/                # TypeScript types
```

---

## Authentication & Authorization

### Role Hierarchy

1. **superadmin**: Akses penuh, termasuk user approval
2. **admin**: Akses operasional, tidak bisa approve user
3. **user**: Akses terbatas untuk operasi dasar

### Alur Login

```
1. User submit username & password
2. System validasi:
   - Username exists
   - Password match (bcrypt verify)
3. Jika valid:
   - Generate JWT token (expires: 7 days)
   - Set HTTP-only cookie
   - Log audit event: LOGIN_SUCCESS
   - Return user data (id, username, email, role)
4. Jika invalid:
   - Log audit event: LOGIN_FAILED
   - Return error 401
```

**Rate Limit**: 20 requests per minute per IP

### Session Management

- **Cookie Name**: `auth_session`
- **HttpOnly**: Yes (XSS protection)
- **Secure**: Yes (production only)
- **SameSite**: Lax (CSRF protection)
- **Max-Age**: 7 days

### Middleware Protection

Semua route `/api/*` (kecuali `/api/auth/login` dan `/api/auth/check`) memerlukan:
1. Valid JWT token di cookie
2. Session tidak expired
3. Rate limiting sesuai konfigurasi

---

## User Management

### Alur Registrasi User

```
1. User submit registration request:
   - username (unique)
   - email (unique, format validation)
   - password (min 8 karakter)
   - requestedRole: 'admin' atau 'user' (default: 'user')

2. System validasi:
   - Username tidak ada di users table
   - Email tidak ada di users table
   - Username tidak ada di pending_user_requests
   - Email tidak ada di pending_user_requests
   - Password strength (min 8 karakter)
   - Email format valid

3. Jika valid:
   - Hash password (bcrypt, 12 rounds)
   - Insert ke pending_user_requests dengan status='pending'
   - Return success message

4. Jika invalid:
   - Return error dengan detail validation
```

**Catatan**: User tidak langsung dibuat, harus menunggu approval dari superadmin.

### Alur Approval User (Superadmin Only)

```
1. Superadmin melihat daftar pending requests di /user-approval
2. Superadmin pilih request dan assign role:
   - Bisa assign: 'superadmin', 'admin', atau 'user'
   - Bisa berbeda dari requestedRole

3. System proses approval:
   BEGIN TRANSACTION
   - Insert ke users table dengan approvedRole
   - Update pending_user_requests:
     * status = 'approved'
     * approved_role = approvedRole
     * approved_by = superadmin.id
     * updated_at = NOW()
   COMMIT TRANSACTION

4. Log audit event: USER_REQUEST_APPROVED

5. User sekarang bisa login
```

### Alur Reject User (Superadmin Only)

```
1. Superadmin reject request dengan optional reason
2. System update pending_user_requests:
   - status = 'rejected'
   - rejected_by = superadmin.id
   - rejection_reason = reason
   - updated_at = NOW()

3. Log audit event: USER_REQUEST_REJECTED

4. User tidak dibuat, request ditandai sebagai rejected
```

**Validasi Requested Role**:
- User hanya bisa request: 'admin' atau 'user'
- Superadmin bisa assign: 'superadmin', 'admin', atau 'user'

---

## Application Management

### CRUD Operations

#### Create Application

```
POST /api/applications
Body: { appName: string }

Validasi:
- appName required dan tidak kosong
- appName unique (case-sensitive)

Jika valid:
- Insert ke app_identifier table
- Return: { id, appName }
```

#### Read Applications

```
GET /api/applications

Return: Array of { id, app_name }
Ordered by: app_name ASC
```

**Tidak ada rate limiting khusus** (menggunakan default READ limit: 100/min)

---

## Dictionary Management

### Upload Dictionary Flow

**File Format**: Excel (.xlsx, .xls) atau CSV (.csv)

**Required Columns**:
1. `Jenis Transaksi` (required)
2. `RC` (required)
3. `S/N` (required) - nilai: S, N, atau Sukses/Success/Berhasil
4. `RC Description` (optional)

**Alur Upload**:

```
1. User pilih application dan upload file
2. Frontend validasi:
   - File extension (.xlsx/.xls/.csv)
   - Parse file (XLSX library atau custom CSV parser)
   - Validate columns (case-insensitive)
   - Validate rows:
     * S/N harus: S, N, Sukses/Success/Berhasil
     * Skip rows dengan S/N invalid
     * Skip completely empty rows

3. Jika ada skipped rows:
   - Return error dengan detail skippedRows
   - Upload DIBATALKAN (tidak ada data yang di-insert)

4. Jika semua rows valid:
   POST /api/upload-dictionary
   - Verify application exists
   - BEGIN TRANSACTION
   
   For each row:
     - Map S/N ke error_type:
       * S → 'S'
       * N → 'N'
       * Sukses/Success/Berhasil → 'Sukses'
     
     - Upsert ke response_code_dictionary:
       * Unique key: (id_app_identifier, jenis_transaksi, rc)
       * Update: error_type, rc_description (preserve existing jika null)
   
   - Auto-remap unmapped_rc:
     For each unmapped_rc entry untuk application ini:
       - Cari di dictionary (exact match: id_app_identifier + jenis_transaksi + rc)
       - Hanya exact match, tidak ada fallback ke RC only
       - Jika jenis_transaksi kosong, skip (tidak bisa exact match)
       - Jika found:
         * Update app_success_rate.error_type
         * Delete dari unmapped_rc
   
   COMMIT TRANSACTION

5. Return success dengan:
   - entriesProcessed count
   - remappedCount (unmapped RC yang auto-remapped)
```

**Rate Limit**: 100 requests per hour per IP

**Business Rules**:
- Dictionary entry unique per: (application, jenis_transaksi, rc)
- rc_description di-preserve jika null (COALESCE logic)
- Upload dictionary akan auto-remap unmapped_rc yang sekarang match

### View Dictionary

```
GET /api/dictionary?search=&error_type=&app_id=&jenis_transaksi=&page=&limit=

Filters:
- search: Search di rc, jenis_transaksi, app_name, rc_description
- error_type: Multiple (comma-separated): S,N,Sukses
- app_id: Multiple (comma-separated)
- jenis_transaksi: Multiple (comma-separated)
- page, limit: Pagination (default: page=1, limit=25)

Return:
{
  success: true,
  data: DictionaryViewEntry[],
  total: number,
  page: number,
  limit: number,
  totalPages: number
}
```

### Update Dictionary Entry

```
PATCH /api/dictionary/update
Body: { id: number, error_type: 'S' | 'N' | 'Sukses' }

Alur:
1. Verify dictionary entry exists
2. Update response_code_dictionary.error_type
3. Update app_success_rate.error_type untuk entries yang match:
   - id_app_identifier = entry.id_app_identifier
   - jenis_transaksi = entry.jenis_transaksi
   - rc = entry.rc
   - error_type IS NULL (hanya update yang belum ter-mapping)

Return: Success dengan updated entry
```

### Update RC Description

```
PATCH /api/dictionary/update-description
Body: { id: number, rc_description: string }

Update rc_description untuk dictionary entry
```

---

## Success Rate Upload

### Upload Success Rate Flow

**File Format**: Excel (.xlsx, .xls) atau CSV (.csv)

**Required Columns**:
1. `Tanggal Transaksi` (required) - Format: DD/MM/YYYY atau YYYY-MM-DD
2. `Jenis Transaksi` (required)
3. `RC` (optional - bisa null/kosong)
4. `total transaksi` (optional)
5. `Total Nominal` (optional)
6. `Total Biaya Admin` (optional)
7. `Status Transaksi` (optional - bisa value apapun)
8. `RC Description` (optional)

**Alur Upload**:

```
1. User pilih application dan upload file
2. Frontend validasi:
   - File extension
   - Parse file
   - Validate columns (case-insensitive)
   - Validate rows:
     * Tanggal Transaksi: parse DD/MM/YYYY atau YYYY-MM-DD
     * Jenis Transaksi: required, tidak boleh kosong
     * RC: optional (bisa null/kosong/'-')
     * Skip completely empty rows (10 consecutive empty = stop)

3. Jika ada skipped rows:
   - Return error dengan detail skippedRows
   - Upload DIBATALKAN

4. Jika semua rows valid:
   POST /api/upload-success-rate
   - Verify application exists
   - BEGIN TRANSACTION
   
   For each entry:
     A. Parse tanggal_transaksi:
        - Extract bulan dan tahun
        - Format: YYYY-MM-DD
     
     B. Business Rule: Auto-set RC untuk transaksi sukses
        Jika RC kosong/null/'-' DAN:
        (RC Description = 'sukses'/'success'/'berhasil' ATAU
         Status Transaksi = 'sukses'/'success'/'berhasil'):
        → Set RC = '00'
     
     C. Assign error_type berdasarkan RC:
        
        Jika RC ada (tidak null/kosong/'-') DAN jenis_transaksi ada:
          - Cari di dictionary (exact match: id_app_identifier + jenis_transaksi + rc)
          - Hanya exact match, tidak ada fallback ke RC only
          - Jika found:
            → error_type = dictionary.error_type
          - Jika tidak found:
            → Insert ke unmapped_rc
            → error_type = NULL
        
        Jika RC kosong/null/'-':
          - Jika (RC Description sukses ATAU Status sukses):
            → RC = '00', error_type = 'Sukses'
          - Jika tidak:
            → error_type = NULL (akan tampil di No RC Transaction)
     
     D. Insert ke app_success_rate:
        - id_app_identifier
        - tanggal_transaksi, bulan, tahun
        - jenis_transaksi
        - rc (bisa null atau '00' jika auto-set)
        - rc_description
        - total_transaksi, total_nominal, total_biaya_admin
        - status_transaksi
        - error_type (bisa NULL jika tidak ter-mapping)
   
   COMMIT TRANSACTION

5. Return success dengan entriesProcessed count
```

**Rate Limit**: 100 requests per hour per IP

**Business Rules Penting**:

1. **RC Auto-Set untuk Sukses**:
   - Jika RC kosong/null/'-' DAN ada indikasi sukses (RC Description atau Status Transaksi) → RC = '00', error_type = 'Sukses'

2. **Error Type Assignment**:
   - Priority 1: Exact match (id_app_identifier + jenis_transaksi + rc) di dictionary
     - **Tidak ada fallback ke RC only** karena jenis_transaksi dan id_app_identifier juga mempengaruhi RC
   - Priority 2: Jika tidak found → masuk unmapped_rc, error_type = NULL
   - Priority 3: Jika RC kosong dan tidak sukses → error_type = NULL (No RC Transaction)

3. **Transaction Safety**:
   - Semua validasi dilakukan SEBELUM insert
   - Jika ada error, ROLLBACK (tidak ada partial insert)

---

## Unmapped RC Handling

### View Unmapped RC

```
GET /api/unmapped-rc?appId=

Return: Array of UnmappedRC
Ordered by: created_at DESC

Filter:
- appId: Filter by application (optional)
```

**Unmapped RC adalah RC yang**:
- Ada di app_success_rate
- Tidak ada di response_code_dictionary (untuk application tersebut)
- error_type = NULL di app_success_rate

### Submit Unmapped RC (Single)

```
POST /api/unmapped-rc/submit
Body: {
  id: number,                    // unmapped_rc.id
  id_app_identifier: number,
  jenis_transaksi: string | null,
  rc: string,
  error_type: 'S' | 'N' | 'Sukses'
}

Alur:
BEGIN TRANSACTION

1. Upsert ke response_code_dictionary:
   - Unique key: (id_app_identifier, jenis_transaksi, rc)
   - Update: error_type

2. Update app_success_rate:
   - Update error_type untuk entries yang match:
     * id_app_identifier = ?
     * rc = ?
     * jenis_transaksi = ? (jika provided)
     * Kondisi update:
       - error_type IS NULL, ATAU
       - status_transaksi IN ('pending', 'suspect', 'cancelled') AND error_type = 'S'
   
   Catatan: Hanya update entries yang:
     - Belum ter-mapping (error_type IS NULL), ATAU
     - Status pending/suspect/cancelled dengan error_type='S' (default value yang bisa di-override)

3. Delete dari unmapped_rc:
   DELETE FROM unmapped_rc WHERE id = ?

COMMIT TRANSACTION

Return: Success message
```

**Business Rules**:
- Jika jenis_transaksi provided: Update hanya entries dengan jenis_transaksi yang sama
- Jika jenis_transaksi NULL: Update semua entries dengan RC tersebut (regardless jenis_transaksi)
- Hanya update entries yang belum ter-mapping atau status pending/suspect/cancelled dengan error_type='S'

### Submit Unmapped RC (Batch)

```
POST /api/unmapped-rc/submit-batch
Body: {
  entries: Array<{
    id: number,
    id_app_identifier: number,
    jenis_transaksi: string | null,
    rc: string,
    error_type: 'S' | 'N' | 'Sukses'
  }>
}

Alur: Sama dengan single submit, tapi dalam loop untuk setiap entry
Semua dalam satu transaction (all-or-nothing)
```

---

## No RC Transaction Handling

### View No RC Transactions

```
GET /api/no-rc-transaction?appId=&page=&limit=

Return: Paginated SuccessRateEntry[]

Filter:
- appId: Filter by application (optional)
- page, limit: Pagination (default: page=1, limit=25)

Query Condition:
WHERE rc IS NULL AND error_type IS NULL

Ordered by: created_at DESC
```

**No RC Transaction adalah transaksi yang**:
- rc IS NULL di app_success_rate
- error_type IS NULL di app_success_rate
- Tidak ter-cover oleh business rule auto-set RC='00' untuk sukses

### Submit No RC Transaction

```
POST /api/no-rc-transaction/submit
Body: {
  id: number,              // app_success_rate.id
  rc: string,              // RC yang akan di-assign
  rc_description: string | null
}

Alur:
BEGIN TRANSACTION

1. Update app_success_rate:
   - Set rc = ?
   - Set rc_description = ?
   - updated_at = CURRENT_TIMESTAMP

2. Get id_app_identifier dan jenis_transaksi dari record

3. Cek apakah RC ada di dictionary:
   
   Jika RC ada di dictionary:
     - Get error_type dari dictionary
     - Update app_success_rate.error_type = dictionary.error_type
   
   Jika RC tidak ada di dictionary:
     - Insert ke unmapped_rc (upsert, ignore duplicate)
     - error_type tetap NULL di app_success_rate

COMMIT TRANSACTION

Return: Success message
```

**Business Rules**:
- Setelah assign RC, system otomatis cek dictionary
- Jika RC ada di dictionary → auto-assign error_type
- Jika RC tidak ada → masuk unmapped_rc untuk di-mapping manual

### Submit No RC Transaction (Batch)

```
POST /api/no-rc-transaction/submit-batch
Body: {
  entries: Array<{
    id: number,
    rc: string,
    rc_description: string | null
  }>
}

Alur: Sama dengan single submit, dalam loop untuk setiap entry
Semua dalam satu transaction
```

---

## Rate Limiting

### Konfigurasi Rate Limit

Rate limiting diterapkan di middleware untuk semua route `/api/*`.

**Rate Limit Configurations**:

```typescript
RESTART_DB: 1 request per hour
UPLOAD: 100 requests per hour
READ: 100 requests per minute
WRITE: 50 requests per minute
AUTH: 20 requests per minute
```

### Route-Specific Limits

- `/api/restart-db`: RESTART_DB (1/hour)
- `/api/upload-*`: UPLOAD (100/hour)
- `/api/auth/check`: READ (100/min) - lebih tinggi karena dipanggil frequently
- `/api/auth/*`: AUTH (20/min)
- POST/PUT/DELETE/PATCH: WRITE (50/min)
- Default: READ (100/min)

### Implementation

- **Storage**: In-memory store (untuk production, disarankan Redis)
- **Key**: `ratelimit:{ip}:{pathname}`
- **Window**: Sliding window per route pattern
- **Response Headers**:
  - `X-RateLimit-Limit`: Max requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time (ISO string)
  - `Retry-After`: Seconds until reset

**Error Response** (429):
```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later."
}
```

---

## Audit Logging

### Audit Events

Semua aktivitas penting di-log ke `audit_logs` table.

**Event Types**:
- `LOGIN_SUCCESS`: User berhasil login
- `LOGIN_FAILED`: Login attempt gagal
- `USER_REQUEST_APPROVED`: Superadmin approve user request
- `USER_REQUEST_REJECTED`: Superadmin reject user request
- (dan lainnya sesuai kebutuhan)

### Audit Log Fields

```typescript
{
  user_id: number | null,        // null untuk failed login
  username: string | null,
  action: string,                 // Event type
  resource_type: string,          // 'auth', 'pending_user_request', dll
  resource_id: string | null,    // ID resource yang di-akses
  details: string | null,         // Additional details
  ip_address: string | null,      // Client IP
  user_agent: string | null,      // Browser user agent
  created_at: Date
}
```

### IP Address Detection

Priority:
1. `x-forwarded-for` header (first IP jika multiple)
2. `x-real-ip` header
3. `null` jika tidak ada

### Error Handling

Audit logging failures **tidak akan break application**. Jika insert audit log gagal, hanya di-log ke console, tidak throw error.

### Audit Log Dashboard

Superadmin dapat mengakses halaman **Audit Logs Dashboard** di `/audit-logs` untuk:
- Melihat semua audit logs dengan filtering (action, resource_type, username, date range)
- Melihat statistik:
  - Total activities (last 30 days)
  - Top actions dengan bar chart
  - Top resource types
  - Daily activity chart (last 7 days)
  - Most active users
- Pagination untuk navigasi logs
- Real-time monitoring aktivitas sistem

**API Endpoints**:
- `GET /api/audit-logs`: Fetch audit logs dengan filtering dan pagination (superadmin only)
- `GET /api/audit-logs/stats`: Get audit log statistics untuk dashboard (superadmin only)

---

## Database Schema

### Core Tables

#### `users`
```sql
id (PK, auto-increment)
username (unique)
email (unique)
password_hash
role (enum: 'superadmin', 'admin', 'user')
created_at
updated_at
```

#### `pending_user_requests`
```sql
id (PK, auto-increment)
username (unique)
email (unique)
password_hash
requested_role (enum: 'admin', 'user')
requested_by (FK users.id, nullable)
status (enum: 'pending', 'approved', 'rejected')
approved_role (enum, nullable)
approved_by (FK users.id, nullable)
rejected_by (FK users.id, nullable)
rejection_reason (text, nullable)
created_at
updated_at
```

#### `app_identifier`
```sql
id (PK, auto-increment)
app_name (unique)
```

#### `response_code_dictionary`
```sql
id (PK, auto-increment)
id_app_identifier (FK app_identifier.id)
jenis_transaksi (varchar)
rc (varchar)
rc_description (text, nullable)
error_type (enum: 'S', 'N', 'Sukses')
UNIQUE KEY (id_app_identifier, jenis_transaksi, rc)
```

#### `app_success_rate`
```sql
id (PK, auto-increment)
id_app_identifier (FK app_identifier.id)
tanggal_transaksi (date)
bulan (varchar)
tahun (int)
jenis_transaksi (varchar)
rc (varchar, nullable)
rc_description (text, nullable)
total_transaksi (int, nullable)
total_nominal (decimal, nullable)
total_biaya_admin (decimal, nullable)
status_transaksi (varchar, nullable)
error_type (enum: 'S', 'N', 'Sukses', nullable)
created_at
updated_at
```

#### `unmapped_rc`
```sql
id (PK, auto-increment)
id_app_identifier (FK app_identifier.id)
jenis_transaksi (varchar, nullable)
rc (varchar)
rc_description (text, nullable)
status_transaksi (varchar, nullable)
error_type (enum, nullable)
created_at
UNIQUE KEY (id_app_identifier, jenis_transaksi, rc)
```

#### `audit_logs`
```sql
id (PK, auto-increment)
user_id (FK users.id, nullable)
username (varchar, nullable)
action (varchar)
resource_type (varchar)
resource_id (varchar, nullable)
details (text, nullable)
ip_address (varchar, nullable)
user_agent (text, nullable)
created_at
```

#### `rate_limit_logs` (optional, untuk tracking)
```sql
id (PK, auto-increment)
ip_address (varchar)
pathname (varchar)
count (int)
reset_at (timestamp)
created_at
```

### Database Support

Aplikasi mendukung **multi-database**:
- **MySQL**: Primary database
- **PostgreSQL**: Alternative database

Database adapter di `src/lib/db.ts` menangani perbedaan syntax:
- INSERT IGNORE (MySQL) vs ON CONFLICT DO NOTHING (PostgreSQL)
- Parameter binding: `?` (MySQL) vs `$1, $2, ...` (PostgreSQL)
- Quote identifiers: Backticks (MySQL) vs Double quotes (PostgreSQL)

---

## Business Logic Summary

### Error Type Assignment Priority

1. **Exact Match**: Dictionary lookup dengan (id_app_identifier, jenis_transaksi, rc)
   - **Tidak ada fallback ke RC only** karena jenis_transaksi dan id_app_identifier juga mempengaruhi RC
   - Jika jenis_transaksi kosong, tidak bisa exact match → masuk unmapped_rc
2. **Auto-Set Sukses**: Jika RC kosong/null/'-' dan ada indikasi sukses → RC='00', error_type='Sukses'
3. **Unmapped**: Jika tidak found di dictionary → masuk unmapped_rc, error_type=NULL
4. **No RC**: Jika RC kosong dan tidak sukses → error_type=NULL (tampil di No RC Transaction)

### Transaction Safety

Semua operasi yang mengubah data menggunakan **database transactions**:
- Upload dictionary: Transaction untuk semua inserts
- Upload success rate: Transaction untuk semua inserts
- Submit unmapped RC: Transaction untuk dictionary insert + app_success_rate update + unmapped_rc delete
- Submit no RC transaction: Transaction untuk update + dictionary check + unmapped_rc insert

**Rollback** terjadi jika:
- Database error
- Validation error setelah transaction dimulai
- Any exception dalam transaction block

### Data Integrity

1. **Unique Constraints**:
   - users: username, email
   - pending_user_requests: username, email
   - app_identifier: app_name
   - response_code_dictionary: (id_app_identifier, jenis_transaksi, rc)
   - unmapped_rc: (id_app_identifier, jenis_transaksi, rc)

2. **Foreign Key Constraints**:
   - Semua FK ke app_identifier.id
   - Semua FK ke users.id (nullable untuk audit logs)

3. **Cascade Rules**:
   - Tergantung database configuration
   - Umumnya: ON DELETE RESTRICT untuk data integrity

---

## Security Considerations

1. **Password Security**:
   - bcrypt hashing dengan 12 rounds
   - Password tidak pernah disimpan dalam plain text
   - Password tidak pernah dikembalikan dalam response

2. **Session Security**:
   - JWT dengan HTTP-only cookies (XSS protection)
   - Secure flag di production (HTTPS only)
   - SameSite=Lax (CSRF protection)
   - Token expiration: 7 days

3. **Rate Limiting**:
   - Proteksi dari brute force attacks
   - Proteksi dari API abuse
   - Different limits untuk different operations

4. **Input Validation**:
   - Semua input di-validate sebelum processing
   - File upload validation (extension, format, columns)
   - SQL injection protection via parameterized queries

5. **Audit Logging**:
   - Tracking semua aktivitas penting
   - IP address dan user agent logging
   - Failed login attempts logging

---

## Error Handling

### Standard Error Response Format

```typescript
{
  success: false,
  message: string
}
```

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

### Validation Errors

Upload operations return detailed validation errors:
```json
{
  "success": false,
  "message": "Upload gagal: X row(s) memiliki error dan di-skip",
  "data": {
    "skippedRows": [
      {
        "rowNumber": 5,
        "reason": "Kolom S/N tidak valid: 'X'. Nilai yang diterima: S, N, Sukses/Success/Berhasil"
      }
    ],
    "totalSkipped": 1,
    "totalProcessed": 0
  }
}
```

---

## Best Practices

1. **File Upload**:
   - Validasi file sebelum parsing
   - Validasi semua rows sebelum insert
   - Gunakan transaction untuk atomicity
   - Return detailed error messages untuk debugging

2. **Database Operations**:
   - Selalu gunakan parameterized queries
   - Gunakan transactions untuk multi-step operations
   - Handle database errors gracefully
   - Support multi-database dengan adapter pattern

3. **Error Handling**:
   - Jangan expose internal errors ke client
   - Log errors ke console untuk debugging
   - Return user-friendly error messages
   - Maintain audit trail untuk security

4. **Performance**:
   - Pagination untuk large datasets
   - Index pada frequently queried columns
   - Connection pooling untuk database
   - Rate limiting untuk API protection

---

## Maintenance & Monitoring

### Logs

- **Application Logs**: Console logs untuk errors dan important events
- **Audit Logs**: Database table untuk tracking user activities
- **Rate Limit Logs**: Optional tracking untuk rate limit violations

### Database Migrations

Aplikasi menggunakan TypeORM migrations:
- Generate: `npm run migration:generate`
- Run: `npm run migration:run`
- Revert: `npm run migration:revert`
- Show: `npm run migration:show`

Support untuk MySQL dan PostgreSQL dengan separate config files.

---

## Conclusion

Dashboard Grafana adalah aplikasi comprehensive untuk mengelola data aplikasi, dictionary response code, dan success rate transaksi dengan sistem autentikasi yang kuat, audit logging, dan rate limiting. Semua business logic telah di-document dengan detail untuk memastikan konsistensi dan maintainability.

Untuk pertanyaan atau issues, silakan refer ke dokumentasi ini atau contact development team.

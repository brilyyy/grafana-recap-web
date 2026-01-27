# Perubahan Code yang Diperlukan Berdasarkan Jawaban Developer

> **⚠️ UPDATE PENTING (2025-01-27):**  
> Setelah klarifikasi tambahan dari developer, ada business rule khusus untuk transaksi sukses:
> - Untuk transaksi dengan RC NULL atau RC='-', cek RC Description ATAU status_transaksi
> - Jika salah satu menunjukkan 'Sukses/Success/Berhasil' → error_type = 'Sukses'
> - Lihat `BUSINESS_RULE_SUMMARY.md` untuk detail lengkap business rule

## 🔴 Critical Changes (Harus Diubah)

### 1. Hapus Validasi Status Transaksi yang Membatasi Nilai

**File:** `src/app/api/upload-success-rate/route.ts`

**Masalah:** 
- Line 299-358: Status_transaksi divalidasi hanya untuk nilai tertentu (sukses, failed, pending, suspect, cancelled)
- Line 355: Error message menunjukkan nilai yang diterima

**Perubahan:**
```typescript
// SEBELUM (Line 299-358):
let statusTransaksi: 'sukses' | 'failed' | 'pending' | 'suspect' | 'cancelled' | null = null
const rawStatus = rowData['Status Transaksi']
const normalizedStatus = rawStatus.toLowerCase()
// ... validasi dengan if-else untuk nilai tertentu (sukses, failed, pending, suspect, cancelled)
if (statusTransaksi === null) {
  skippedRows.push({
    rowNumber: actualRowNumber,
    reason: `Status Transaksi tidak valid: "${rawStatus || '(kosong)'}". Nilai yang diterima: sukses/Success/SUCCESS/SUKSES, failed/Failed/FAILED/Gagal/GAGAL/Failure, pending/Pending/PENDING, suspect/Suspect/SUSPECT, cancelled/Cancelled/CANCELLED/canceled/Canceled/CANCELED`
  })
  continue
}

// SESUDAH:
let statusTransaksi: string | null = null
const rawStatus = rowData['Status Transaksi']?.trim() || null
if (rawStatus && rawStatus !== '') {
  statusTransaksi = rawStatus // Simpan value asli, tidak perlu validasi enum
}
// Hapus semua validasi status_transaksi yang membatasi nilai
// Status_transaksi bisa value apapun, akan digunakan untuk business rule error_type assignment
```

**Lokasi:** 
- CSV parsing: Line 298-358
- Excel parsing: Line 616-636

---

### 2. Update Business Rule untuk Transaksi Sukses (Klarifikasi)

**File:** `src/app/api/upload-success-rate/route.ts`

**Klarifikasi dari Developer:**
Untuk transaksi sukses yang tidak memiliki RC atau RC='-', ada business rule khusus:
- Cek apakah RC Description = 'Sukses/Success/Berhasil' ATAU
- Cek apakah status_transaksi = 'Sukses/Success/Berhasil'
- Jika salah satu match → error_type = 'Sukses'

**Masalah Saat Ini:**
- Line 361-368: Business rule yang assign RC='00' dan RC Description='Success' jika status='sukses'
- Ini perlu diubah karena tidak sesuai dengan requirement (tidak boleh auto-assign RC)

**Perubahan:**
```typescript
// SEBELUM (Line 361-368):
// Apply business rules for successful transactions
if (statusTransaksi === 'sukses') {
  if (!rcDescription || rcDescription === '') {
    rcDescription = 'Success'
  }
  if (!rc || rc === '') {
    rc = '00'
  }
}

// SESUDAH:
// Jangan auto-assign RC atau RC Description berdasarkan status
// Business rule untuk error_type='Sukses' akan di-handle di logic error_type assignment (lihat perubahan #3)
// HAPUS BAGIAN INI - tidak perlu auto-assign RC/RC Description
```

**Catatan:** 
- Jangan auto-assign RC='00' atau RC Description='Success'
- Biarkan RC dan RC Description sesuai dengan yang di-upload user
- Logic untuk assign error_type='Sukses' akan di-handle di bagian error_type assignment

**Lokasi:**
- CSV parsing: Line 360-368 (HAPUS)
- Excel parsing: Tidak ada di Excel parsing (sudah benar)

---

### 3. Update Logic Error Type Assignment untuk Transaksi Sukses (Klarifikasi)

**File:** `src/app/api/upload-success-rate/route.ts`

**Klarifikasi dari Developer:**
Untuk transaksi yang tidak memiliki RC atau RC='-', ada business rule khusus:
- Jika RC NULL atau RC='-', cek:
  1. RC Description = 'Sukses/Success/Berhasil' (case-insensitive), ATAU
  2. status_transaksi = 'Sukses/Success/Berhasil' (case-insensitive)
- Jika salah satu match → error_type = 'Sukses'
- Jika tidak match → error_type = NULL

**Masalah Saat Ini:**
- Line 769-780: Logic hanya cek status_transaksi, belum cek RC Description
- Perlu update untuk include kedua kondisi

**Perubahan:**
```typescript
// SEBELUM (Line 724 & 767-783):
// Line 724: Check RC
if (entry.rc && entry.rc !== '' && entry.rc !== null) {
  // ... dictionary lookup logic
} else {
  // RC kosong/null
  // Check if status_transaksi is "sukses" (case-insensitive)
  const normalizedStatus = entry.status_transaksi?.toLowerCase() || ''
  if (
    normalizedStatus === 'sukses' ||
    normalizedStatus === 'success' ||
    entry.status_transaksi?.toUpperCase() === 'SUCCESS' ||
    entry.status_transaksi?.toUpperCase() === 'SUKSES'
  ) {
    // RC NULL + status sukses → error_type = 'Sukses'
    entry.error_type = 'Sukses'
  } else {
    // RC NULL + status != sukses → error_type = NULL (akan tampil di No RC Transaction Card)
    entry.error_type = null
  }
}

// SESUDAH:
// Line 724: Update check untuk include RC='-'
const rcValue = entry.rc?.trim() || ''
const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'

if (!isRcEmpty) {
  // RC ada → Cari di dictionary
  // ... dictionary lookup logic (sama seperti sebelumnya)
} else {
  // RC kosong/null atau RC='-' atau RC kosong string
  // Business rule khusus untuk transaksi sukses:
  // Cek RC Description ATAU status_transaksi untuk menentukan apakah sukses
  const normalizedRcDescription = entry.rc_description?.toLowerCase()?.trim() || ''
  const normalizedStatus = entry.status_transaksi?.toLowerCase()?.trim() || ''
  
  const isRcDescriptionSukses = 
    normalizedRcDescription === 'sukses' ||
    normalizedRcDescription === 'success' ||
    normalizedRcDescription === 'berhasil'
  
  const isStatusSukses = 
    normalizedStatus === 'sukses' ||
    normalizedStatus === 'success' ||
    normalizedStatus === 'berhasil'
  
  if (isRcDescriptionSukses || isStatusSukses) {
    // RC NULL/empty/'-' + (RC Description sukses ATAU status sukses) → error_type = 'Sukses'
    entry.error_type = 'Sukses'
  } else {
    // RC NULL/empty/'-' + tidak ada indikasi sukses → error_type = NULL (akan tampil di No RC Transaction Card)
    entry.error_type = null
  }
}
```

**Catatan:**
- Logic ini hanya berlaku untuk transaksi dengan RC NULL, RC='', atau RC='-'
- Jika RC ada (meskipun tidak di dictionary), tetap lookup dari dictionary dulu
- Hanya jika RC NULL/empty/'-', baru cek RC Description atau status_transaksi
- Cek dilakukan dengan case-insensitive untuk: 'sukses', 'success', 'berhasil'
- Jika salah satu (RC Description ATAU status_transaksi) menunjukkan sukses → error_type='Sukses'

**Lokasi:** Line 767-783

---

### 4. Update Filter No RC Transaction

**File:** `src/app/api/no-rc-transaction/route.ts`

**Masalah:**
- Line 37 & 54: Filter untuk exclude status='sukses' karena diasumsikan selalu punya error_type='Sukses'
- Tapi berdasarkan requirement baru, status tidak mempengaruhi error_type

**Perubahan:**
```typescript
// SEBELUM (Line 36-37):
WHERE a.rc IS NULL
  AND (a.status_transaksi IS NULL OR LOWER(a.status_transaksi) NOT IN ('sukses', 'success'))

// SESUDAH:
WHERE a.rc IS NULL
  AND a.error_type IS NULL
```

**Catatan:** Filter berdasarkan error_type IS NULL lebih tepat karena:
- Error_type hanya di-assign berdasarkan RC dari dictionary
- Jika RC NULL, error_type akan NULL (tidak peduli status)
- Filter ini lebih sesuai dengan requirement baru

**Lokasi:** Line 36-37 dan Line 53-54

---

## 🟡 Medium Priority Changes

### 5. Standardize CSV dan Excel Parser

**File:** 
- `src/components/DictionaryUploadCard.tsx`
- `src/components/AddSuccessRateCard.tsx`
- `src/app/api/upload-dictionary/route.ts`
- `src/app/api/upload-success-rate/route.ts`

**Masalah:**
- CSV parser dan Excel parser memiliki logic yang sedikit berbeda
- Perlu disamakan untuk konsistensi

**Rekomendasi:**
1. Extract CSV parser ke utility: `src/utils/csvParser.ts`
2. Extract Excel parser logic ke utility: `src/utils/excelParser.ts`
3. Gunakan utilities yang sama di semua tempat
4. Pastikan logic stop setelah 10 consecutive empty rows sama di CSV dan Excel

**Lokasi:**
- DictionaryUploadCard: Line 68-132 (CSV), Line 228-370 (Excel)
- AddSuccessRateCard: Line 76-140 (CSV), Line 194-263 (Excel)
- upload-dictionary/route.ts: Line 7-71 (CSV), Line 228-370 (Excel)
- upload-success-rate/route.ts: Line 7-71 (CSV), Line 395-663 (Excel)

---

### 6. Audit Memory Leaks dari Event Listeners

**File:** Semua components yang menggunakan `window.addEventListener`

**Masalah:**
- Perlu audit untuk memastikan semua event listeners di-cleanup dengan benar

**Components yang perlu diaudit:**
- `AppListCard.tsx` - Line 35-44
- `DictionaryUploadCard.tsx` - Tidak ada event listener (hanya dispatch)
- `AddSuccessRateCard.tsx` - Tidak ada event listener (hanya dispatch)
- `UnmappedRcCard.tsx` - Line 67-80
- `NoRcTransactionCard.tsx` - Line 85-99
- `DictionaryCard.tsx` - Line 101-116

**Checklist:**
- [ ] Semua `addEventListener` memiliki `removeEventListener` di cleanup
- [ ] Dependencies di useEffect dependency array sudah benar
- [ ] Tidak ada event listener yang dibuat di dalam loop atau conditional

---

### 7. Update Transaction Management untuk Batch Operations

**File:** 
- `src/app/api/unmapped-rc/submit-batch/route.ts`
- `src/app/api/no-rc-transaction/submit-batch/route.ts`
- `src/app/api/dictionary/update-description-batch/route.ts`

**Requirement:** Semua batch operations harus all-or-nothing (transaction)

**Perlu dicek:**
- Apakah semua batch operations sudah menggunakan transaction?
- Apakah rollback dilakukan dengan benar jika ada error?

---

## 🟢 Low Priority Changes

### 8. Update Pagination untuk Support Multiple Page Sizes

**File:**
- `src/components/NoRcTransactionCard.tsx`
- `src/components/DictionaryCard.tsx`

**Requirement:** Kedepannya akan ada pilihan 25, 50, atau 100 per page

**Rekomendasi:**
- Tambah dropdown untuk select page size
- Update API calls untuk include limit parameter
- Update state management untuk store selected page size

---

## 📋 Summary of Changes

### Critical (Harus Diubah Sekarang):
1. ✅ Hapus validasi status_transaksi yang membatasi nilai (Line 299-358 di upload-success-rate)
   - Status_transaksi bisa value apapun, tidak ada enum validation
2. ✅ **UPDATE** Hapus business rule auto-assign RC='00' berdasarkan status (Line 361-368)
   - **Klarifikasi:** Tidak perlu auto-assign RC='00' atau RC Description='Success'
   - Biarkan RC dan RC Description sesuai dengan yang di-upload user
3. ✅ **UPDATE** Update logic error_type assignment untuk transaksi sukses (Line 724 & 767-783)
   - **Klarifikasi:** Untuk RC NULL, RC='', atau RC='-':
     - Cek RC Description = 'Sukses/Success/Berhasil' ATAU
     - Cek status_transaksi = 'Sukses/Success/Berhasil'
     - Jika salah satu match → error_type = 'Sukses'
   - Update check RC untuk include RC='-' (Line 724)
4. ✅ Update filter no-rc-transaction (Line 37 & 54)
   - Ubah dari `status != 'sukses'` menjadi `error_type IS NULL`

### Medium Priority:
5. Standardize CSV/Excel parser
6. Audit memory leaks
7. Update transaction management untuk batch operations

### Low Priority:
8. Update pagination untuk multiple page sizes

---

## ⚠️ Impact Analysis

### Breaking Changes:
- **Upload Success Rate:** 
  - File dengan status_transaksi yang sebelumnya di-validasi akan sekarang diterima (tidak ada validasi enum)
  - Transaksi dengan RC NULL atau RC='-' akan di-assign error_type='Sukses' jika RC Description atau status_transaksi menunjukkan sukses
  - Tidak ada lagi auto-assign RC='00' untuk transaksi sukses
- **No RC Transaction:** Filter akan berubah dari `status != 'sukses'` menjadi `error_type IS NULL`, mungkin lebih banyak atau lebih sedikit records yang ditampilkan

### Testing Required:
- ✅ Test upload success rate dengan berbagai status_transaksi values (termasuk nilai yang sebelumnya tidak valid)
- ✅ Test upload dengan RC NULL:
  - RC NULL + RC Description='Sukses' → error_type='Sukses'
  - RC NULL + status_transaksi='Sukses' → error_type='Sukses'
  - RC NULL + RC Description='Success' → error_type='Sukses'
  - RC NULL + status_transaksi='Success' → error_type='Sukses'
  - RC NULL + RC Description='Berhasil' → error_type='Sukses'
  - RC NULL + status_transaksi='Berhasil' → error_type='Sukses'
  - RC NULL + tidak ada indikasi sukses → error_type=NULL
- ✅ Test upload dengan RC='-':
  - RC='-' + RC Description='Sukses' → error_type='Sukses'
  - RC='-' + status_transaksi='Sukses' → error_type='Sukses'
- ✅ Test upload dengan RC ada (dari dictionary) → error_type dari dictionary
- ✅ Test no-rc-transaction filter dengan data yang berbeda
- ✅ Test error_type assignment:
  - RC ada di dictionary → error_type dari dictionary
  - RC NULL + kondisi sukses → error_type='Sukses'
  - RC NULL + tidak sukses → error_type=NULL

---

## 📚 Related Documentation

- **Business Rule Detail:** Lihat `BUSINESS_RULE_SUMMARY.md` untuk penjelasan lengkap business rule error_type assignment
- **Answers Summary:** Lihat `ANSWERS_SUMMARY.md` untuk ringkasan jawaban developer

## 🔍 Files to Review

1. `src/app/api/upload-success-rate/route.ts` - **CRITICAL**
   - Line 299-358: Hapus validasi status_transaksi
   - Line 361-368: Hapus auto-assign RC='00'
   - Line 724: Update logic untuk handle RC='-'
   - Line 767-783: Update logic error_type assignment untuk transaksi sukses
2. `src/app/api/no-rc-transaction/route.ts` - **CRITICAL**
   - Line 37 & 54: Update filter ke `error_type IS NULL`
3. `src/app/api/unmapped-rc/submit/route.ts` - Review logic update app_success_rate
4. `src/app/api/unmapped-rc/submit-batch/route.ts` - Check transaction
5. `src/app/api/dictionary/update/route.ts` - Review error_type update logic
6. Semua components dengan event listeners - Audit memory leaks

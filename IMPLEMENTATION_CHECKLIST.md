# Implementation Checklist - Code Changes

## ✅ Pre-Implementation Checklist

Sebelum memulai perubahan code, pastikan:
- [ ] Sudah membaca `CODE_CHANGES_REQUIRED.md` dengan lengkap
- [ ] Sudah membaca `BUSINESS_RULE_SUMMARY.md` untuk memahami business rule
- [ ] Sudah membaca `ANSWERS_SUMMARY.md` untuk konteks lengkap
- [ ] Sudah membuat backup atau commit current code
- [ ] Sudah membuat branch baru untuk perubahan ini

---

## 🔴 Critical Changes Implementation

### 1. Hapus Validasi Status Transaksi

**File:** `src/app/api/upload-success-rate/route.ts`

**Tasks:**
- [ ] Line 299-358 (CSV parsing): Hapus validasi enum status_transaksi
- [ ] Line 616-636 (Excel parsing): Hapus validasi enum status_transaksi (jika ada)
- [ ] Ubah type dari `'sukses' | 'failed' | ...` menjadi `string | null`
- [ ] Hapus semua if-else untuk validasi nilai status
- [ ] Hapus skippedRows.push untuk status tidak valid
- [ ] Simpan status_transaksi value asli tanpa validasi

**Test Cases:**
- [ ] Upload dengan status_transaksi='custom_status' → harus diterima
- [ ] Upload dengan status_transaksi='SUKSES' → harus diterima
- [ ] Upload dengan status_transaksi='random_value' → harus diterima
- [ ] Tidak ada error "Status Transaksi tidak valid"

---

### 2. Hapus Auto-Assign RC='00'

**File:** `src/app/api/upload-success-rate/route.ts`

**Tasks:**
- [ ] Line 361-368 (CSV parsing): HAPUS seluruh block business rule
- [ ] Pastikan tidak ada logic serupa di Excel parsing
- [ ] RC dan RC Description tetap sesuai dengan yang di-upload user

**Test Cases:**
- [ ] Upload dengan RC NULL + status='sukses' → RC tetap NULL (tidak di-assign '00')
- [ ] Upload dengan RC NULL + status='sukses' → RC Description tetap sesuai upload (tidak di-assign 'Success')
- [ ] Upload dengan RC='-' + status='sukses' → RC tetap '-' (tidak di-assign '00')

---

### 3. Update Logic Error Type Assignment

**File:** `src/app/api/upload-success-rate/route.ts`

**Tasks:**
- [ ] Line 724: Update check RC untuk include RC='-'
  ```typescript
  const rcValue = entry.rc?.trim() || ''
  const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'
  ```
- [ ] Line 767-783: Update logic untuk cek RC Description ATAU status_transaksi
  - Cek RC Description = 'Sukses/Success/Berhasil' (case-insensitive)
  - ATAU cek status_transaksi = 'Sukses/Success/Berhasil' (case-insensitive)
  - Jika salah satu match → error_type = 'Sukses'
  - Jika tidak match → error_type = NULL

**Test Cases:**
- [ ] RC NULL + RC Description='Sukses' → error_type='Sukses'
- [ ] RC NULL + RC Description='Success' → error_type='Sukses'
- [ ] RC NULL + RC Description='Berhasil' → error_type='Sukses'
- [ ] RC NULL + status_transaksi='Sukses' → error_type='Sukses'
- [ ] RC NULL + status_transaksi='Success' → error_type='Sukses'
- [ ] RC NULL + status_transaksi='Berhasil' → error_type='Sukses'
- [ ] RC NULL + RC Description='Sukses' + status_transaksi='failed' → error_type='Sukses' (salah satu match cukup)
- [ ] RC NULL + tidak ada indikasi sukses → error_type=NULL
- [ ] RC='-' + status_transaksi='Sukses' → error_type='Sukses'
- [ ] RC='' (empty) + status_transaksi='Sukses' → error_type='Sukses'
- [ ] RC ada di dictionary → error_type dari dictionary (tidak terpengaruh business rule sukses)

---

### 4. Update Filter No RC Transaction

**File:** `src/app/api/no-rc-transaction/route.ts`

**Tasks:**
- [ ] Line 37: Update WHERE clause
  ```sql
  -- SEBELUM:
  WHERE a.rc IS NULL
    AND (a.status_transaksi IS NULL OR LOWER(a.status_transaksi) NOT IN ('sukses', 'success'))
  
  -- SESUDAH:
  WHERE a.rc IS NULL
    AND a.error_type IS NULL
  ```
- [ ] Line 54: Update count query dengan filter yang sama

**Test Cases:**
- [ ] Transaksi dengan RC NULL + error_type='Sukses' → TIDAK muncul di list
- [ ] Transaksi dengan RC NULL + error_type=NULL → muncul di list
- [ ] Transaksi dengan RC NULL + status='sukses' tapi error_type=NULL → muncul di list
- [ ] Transaksi dengan RC NULL + status='failed' tapi error_type='Sukses' → TIDAK muncul di list

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Test CSV parser dengan berbagai status_transaksi values
- [ ] Test Excel parser dengan berbagai status_transaksi values
- [ ] Test error_type assignment logic untuk semua scenarios

### Integration Tests
- [ ] Test upload success rate dengan RC NULL + berbagai kombinasi RC Description & status
- [ ] Test upload success rate dengan RC='-'
- [ ] Test upload success rate dengan RC ada di dictionary
- [ ] Test no-rc-transaction filter dengan berbagai data

### Manual Testing
- [ ] Upload file dengan status_transaksi='custom_value' → harus berhasil
- [ ] Upload file dengan RC NULL + RC Description='Sukses' → error_type='Sukses'
- [ ] Upload file dengan RC NULL + status_transaksi='Success' → error_type='Sukses'
- [ ] Upload file dengan RC NULL + tidak ada indikasi sukses → error_type=NULL
- [ ] Verify No RC Transaction hanya menampilkan transaksi dengan error_type IS NULL

---

## 📝 Code Review Checklist

Sebelum merge, pastikan:
- [ ] Semua perubahan sesuai dengan `CODE_CHANGES_REQUIRED.md`
- [ ] Tidak ada hardcoded values yang seharusnya dinamis
- [ ] Error handling sudah proper
- [ ] Comments sudah di-update untuk menjelaskan business rule baru
- [ ] Tidak ada console.log atau debug code yang tertinggal
- [ ] Type safety terjaga (tidak ada `any` yang tidak perlu)

---

## 🔄 After Implementation

Setelah implementasi selesai:
- [ ] Update dokumentasi jika ada perubahan behavior
- [ ] Update `CHANGELOG.md` dengan perubahan yang dilakukan
- [ ] Update `business_logic_map.json` dengan confidence score baru
- [ ] Test semua scenarios dari `BUSINESS_RULE_SUMMARY.md`
- [ ] Code review dengan team
- [ ] Deploy ke staging untuk testing lebih lanjut

---

## 📚 Reference Documents

- `CODE_CHANGES_REQUIRED.md` - Detail perubahan code
- `BUSINESS_RULE_SUMMARY.md` - Business rule lengkap dengan examples
- `ANSWERS_SUMMARY.md` - Konteks dari jawaban developer
- `tests_to_add.md` - Test cases yang perlu ditambahkan

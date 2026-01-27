# Business Rule Summary - Transaksi Sukses

## 📋 Business Rule untuk Error Type Assignment

### Rule 1: RC Ada di Dictionary
**Kondisi:** RC tidak NULL, tidak empty, dan bukan '-'

**Logic:**
1. Cari di dictionary dengan exact match: `id_app_identifier + jenis_transaksi + RC`
2. Jika tidak ditemukan, cari dengan RC only: `id_app_identifier + RC`
3. Jika ditemukan → `error_type = error_type dari dictionary`
4. Jika tidak ditemukan → `error_type = NULL` (masuk ke unmapped_rc)

**Priority:** Tertinggi - selalu cek dictionary dulu jika RC ada

---

### Rule 2: RC NULL/Empty/'-' dengan Indikasi Sukses
**Kondisi:** RC NULL, RC='', atau RC='-'

**Logic:**
1. Cek RC Description (case-insensitive):
   - 'sukses' → match
   - 'success' → match
   - 'berhasil' → match
2. ATAU cek status_transaksi (case-insensitive):
   - 'sukses' → match
   - 'success' → match
   - 'berhasil' → match
3. Jika salah satu match → `error_type = 'Sukses'`
4. Jika tidak ada yang match → `error_type = NULL` (masuk ke No RC Transaction)

**Priority:** Kedua - hanya jika RC tidak ada

---

## 🔄 Flow Diagram

```
Upload Success Rate Entry
│
├─ RC ada? (tidak NULL, tidak empty, bukan '-')
│  │
│  ├─ YES → Cari di dictionary
│  │   │
│  │   ├─ Ditemukan → error_type = dari dictionary ✅
│  │   │
│  │   └─ Tidak ditemukan → error_type = NULL (unmapped_rc)
│  │
│  └─ NO → RC NULL/empty/'-'
│      │
│      ├─ RC Description = 'Sukses/Success/Berhasil'?
│      │  └─ YES → error_type = 'Sukses' ✅
│      │
│      └─ ATAU status_transaksi = 'Sukses/Success/Berhasil'?
│         └─ YES → error_type = 'Sukses' ✅
│         └─ NO → error_type = NULL (No RC Transaction)
```

---

## 📝 Contoh Scenarios

### Scenario 1: RC Ada di Dictionary
```
RC: '00'
Jenis Transaksi: 'Transfer'
RC Description: 'Success'
Status Transaksi: 'sukses'
→ error_type = dari dictionary (bisa 'S', 'N', atau 'Sukses')
```

### Scenario 2: RC NULL dengan RC Description Sukses
```
RC: NULL
RC Description: 'Sukses'
Status Transaksi: 'failed'
→ error_type = 'Sukses' ✅
```

### Scenario 3: RC NULL dengan Status Sukses
```
RC: NULL
RC Description: NULL
Status Transaksi: 'Success'
→ error_type = 'Sukses' ✅
```

### Scenario 4: RC NULL tanpa Indikasi Sukses
```
RC: NULL
RC Description: 'Error occurred'
Status Transaksi: 'failed'
→ error_type = NULL (masuk ke No RC Transaction)
```

### Scenario 5: RC='-' dengan Status Sukses
```
RC: '-'
RC Description: NULL
Status Transaksi: 'Berhasil'
→ error_type = 'Sukses' ✅
```

### Scenario 6: RC Ada tapi Tidak di Dictionary
```
RC: '99'
Jenis Transaksi: 'Transfer'
RC Description: NULL
Status Transaksi: 'failed'
→ error_type = NULL (masuk ke unmapped_rc)
```

---

## ⚠️ Important Notes

1. **Tidak ada auto-assign RC:** 
   - Jangan auto-assign RC='00' atau RC Description='Success' berdasarkan status
   - Biarkan RC dan RC Description sesuai dengan yang di-upload user

2. **Status Transaksi tidak divalidasi:**
   - Status_transaksi bisa value apapun (tidak ada enum validation)
   - Hanya digunakan untuk business rule error_type assignment jika RC NULL

3. **Case-insensitive matching:**
   - Semua matching untuk 'Sukses/Success/Berhasil' dilakukan case-insensitive
   - 'SUKSES', 'Sukses', 'sukses' → semua match

4. **Priority:**
   - Dictionary lookup selalu dilakukan dulu jika RC ada
   - Business rule sukses hanya untuk RC NULL/empty/'-'

---

## 🔍 Testing Checklist

- [ ] RC ada di dictionary → error_type dari dictionary
- [ ] RC ada tapi tidak di dictionary → error_type NULL (unmapped_rc)
- [ ] RC NULL + RC Description='Sukses' → error_type='Sukses'
- [ ] RC NULL + RC Description='Success' → error_type='Sukses'
- [ ] RC NULL + RC Description='Berhasil' → error_type='Sukses'
- [ ] RC NULL + status_transaksi='Sukses' → error_type='Sukses'
- [ ] RC NULL + status_transaksi='Success' → error_type='Sukses'
- [ ] RC NULL + status_transaksi='Berhasil' → error_type='Sukses'
- [ ] RC NULL + RC Description='Sukses' + status_transaksi='failed' → error_type='Sukses' (salah satu match cukup)
- [ ] RC NULL + tidak ada indikasi sukses → error_type=NULL
- [ ] RC='-' + status_transaksi='Sukses' → error_type='Sukses'
- [ ] RC='' (empty string) + status_transaksi='Sukses' → error_type='Sukses'

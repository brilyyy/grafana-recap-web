# Pertanyaan untuk Developer - ✅ SUDAH DIJAWAB

Dokumen ini berisi pertanyaan tentang business logic yang tidak jelas dari analisis code. **Semua pertanyaan sudah dijawab oleh developer pada 2025-01-27.**

Lihat `CODE_CHANGES_REQUIRED.md` untuk perubahan code yang diperlukan berdasarkan jawaban ini.

## 1. Error Type Assignment Logic

**Pertanyaan:** Di `upload-success-rate/route.ts`, ada logic untuk update `app_success_rate` entries yang sudah ada dengan error_type tertentu. Kenapa hanya update entries dengan `error_type IS NULL` atau `status_transaksi IN ('pending','suspect','cancelled') AND error_type='S'`?

**Konteks:** 
- Line 487 di `upload-dictionary/route.ts`
- Line 63 di `unmapped-rc/submit/route.ts`

**Asumsi saat ini:** Entries dengan error_type yang sudah di-assign (selain NULL atau 'S' untuk status tertentu) tidak perlu di-update karena sudah final.

**Pertanyaan:** Apakah ini benar? Apakah ada scenario di mana kita perlu overwrite error_type yang sudah ada?

## 2. Status Transaksi Storage

**Pertanyaan:** Di `upload-success-rate/route.ts`, status_transaksi disimpan sebagai VARCHAR dengan value asli (tidak normalize). Tapi di beberapa tempat ada logic yang normalize ke lowercase untuk comparison.

**Konteks:**
- Line 299-350 di `upload-success-rate/route.ts` (CSV parsing)
- Line 617-636 di `upload-success-rate/route.ts` (Excel parsing)

**Asumsi saat ini:** Status disimpan dengan case asli untuk flexibility, tapi di-normalize untuk logic checks.

**Pertanyaan:** Apakah ini intentional? Apakah ada requirement untuk case-sensitive storage?

## 3. Remap Logic setelah Dictionary Upload

**Pertanyaan:** Setelah upload dictionary, ada logic untuk auto-remap unmapped_rc entries. Tapi logic ini hanya update entries dengan kondisi tertentu.

**Konteks:**
- Line 439-508 di `upload-dictionary/route.ts`

**Asumsi saat ini:** Hanya update entries yang belum final (error_type NULL atau status tertentu dengan error_type='S').

**Pertanyaan:** Apakah ini sesuai dengan requirement? Apakah semua unmapped_rc entries yang match harus di-update?

## 4. CSV Parser - Empty Rows Handling

**Pertanyaan:** Di CSV parser, empty rows di-skip secara silent (tidak ditambahkan ke skippedRows). Tapi di Excel parser, ada logic untuk stop setelah 10 consecutive empty rows.

**Konteks:**
- Line 189-196 di `upload-dictionary/route.ts` (CSV)
- Line 324-339 di `upload-dictionary/route.ts` (Excel)

**Asumsi saat ini:** Empty rows di akhir file adalah normal, jadi di-skip. Excel parser stop setelah 10 empty rows untuk performance.

**Pertanyaan:** Apakah ini sesuai dengan requirement? Apakah perlu konsistensi antara CSV dan Excel parser?

## 5. RC Description Update Logic

**Pertanyaan:** Di dictionary update, ada logic untuk update `rc_description` dengan `COALESCE(VALUES(rc_description), rc_description)`. Ini berarti jika rc_description baru NULL, tetap pakai yang lama.

**Konteks:**
- Line 426 di `upload-dictionary/route.ts`

**Asumsi saat ini:** RC Description optional, jika tidak ada di file upload, tetap pakai yang sudah ada di database.

**Pertanyaan:** Apakah ini benar? Atau seharusnya NULL overwrite existing value?

## 6. No RC Transaction Filter

**Pertanyaan:** Di `no-rc-transaction/route.ts`, query filter untuk `status_transaksi IS NULL OR LOWER(status_transaksi) NOT IN ('sukses', 'success')`.

**Konteks:**
- Line 37 di `no-rc-transaction/route.ts`

**Asumsi saat ini:** Hanya tampilkan transaksi tanpa RC yang statusnya bukan sukses.

**Pertanyaan:** Apakah ini sesuai requirement? Apakah transaksi dengan status sukses tapi tanpa RC juga perlu ditampilkan?

## 7. Dictionary Unique Constraint

**Pertanyaan:** Dictionary memiliki UNIQUE constraint pada `(id_app_identifier, jenis_transaksi, rc)`. Ini berarti satu RC bisa punya multiple entries jika jenis_transaksi berbeda.

**Konteks:**
- Line 80 di `restart-db/route.ts`

**Asumsi saat ini:** Satu RC bisa punya error_type berbeda untuk jenis_transaksi berbeda.

**Pertanyaan:** Apakah ini sesuai requirement? Atau seharusnya satu RC punya satu error_type untuk semua jenis_transaksi?

## 8. Error Type ENUM Values

**Pertanyaan:** Error_type menggunakan ENUM('S', 'N', 'Sukses'). Tapi di beberapa tempat ada mapping dari 'Sukses/Success/Berhasil' ke 'Sukses'.

**Konteks:**
- Line 63 di `restart-db/route.ts` (ENUM definition)
- Line 199-210 di `upload-dictionary/route.ts` (mapping logic)

**Asumsi saat ini:** ENUM hanya menerima 'S', 'N', 'Sukses', tapi input bisa berbagai format yang di-normalize.

**Pertanyaan:** Apakah ada requirement untuk menambah nilai ENUM lainnya? Atau tetap hanya 3 nilai ini?

## 9. Transaction Rollback Strategy

**Pertanyaan:** Di beberapa operasi batch, jika ada error di tengah proses, apakah semua perubahan di-rollback atau hanya yang error saja?

**Konteks:**
- `upload-success-rate/route.ts` menggunakan transaction dengan rollback
- `unmapped-rc/submit-batch/route.ts` tidak menggunakan transaction

**Asumsi saat ini:** Upload success rate menggunakan transaction (all-or-nothing), tapi batch submit unmapped RC tidak (partial success mungkin).

**Pertanyaan:** Apakah ini intentional? Apakah batch operations harus all-or-nothing atau boleh partial success?

## 10. Pagination Limit

**Pertanyaan:** Pagination menggunakan limit 25 per page. Apakah ini hardcoded atau bisa dikonfigurasi?

**Konteks:**
- Line 23 di `NoRcTransactionCard.tsx`
- Line 31 di `DictionaryCard.tsx`

**Asumsi saat ini:** Limit 25 adalah default, bisa diubah via query param tapi UI tidak ada option untuk change.

**Pertanyaan:** Apakah perlu tambah UI untuk change page size? Atau tetap 25?

## 11. Custom Events Cleanup

**Pertanyaan:** Di beberapa components, ada event listeners yang di-cleanup di useEffect return. Tapi apakah semua sudah di-cleanup dengan benar?

**Konteks:**
- Multiple components menggunakan `window.addEventListener` dan `window.removeEventListener`

**Asumsi saat ini:** Semua sudah di-cleanup dengan benar berdasarkan code review.

**Pertanyaan:** Apakah perlu audit untuk memastikan tidak ada memory leaks?

## 12. File Upload Size Limit

**Pertanyaan:** Tidak ada file size limit di code. Apakah ada limit di level infrastructure (nginx, etc.) atau memang tidak ada limit?

**Konteks:**
- Tidak ada validasi file size di upload endpoints

**Asumsi saat ini:** Tidak ada limit, bisa jadi masalah untuk file besar.

**Pertanyaan:** Berapa maksimal file size yang diharapkan? Perlu tambah limit?

---

## Catatan untuk Developer

Mohon jawab pertanyaan di atas untuk:
1. Memastikan dokumentasi akurat
2. Mengidentifikasi potential bugs atau improvements
3. Memahami business requirements dengan lebih baik

Setelah dijawab, dokumentasi akan di-update dengan informasi yang benar.

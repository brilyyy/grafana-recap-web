# User Management Technical Notes

## Code Path Utama
- Submit request: `src/app/api/auth/submit-user-request/route.ts`
- List pending request: `src/app/api/auth/pending-user-requests/route.ts`
- Approve request: `src/app/api/auth/approve-user-request/[id]/route.ts`
- Reject request: `src/app/api/auth/reject-user-request/[id]/route.ts`
- Create user/admin langsung: `src/app/api/auth/create-user/route.ts`, `src/app/api/auth/create-admin/route.ts`

## Struktur Data Kunci
- `pending_user_requests`: antrean registrasi.
- `users`: akun aktif.
- Constraint unik penting:
  - `users.username`, `users.email`
  - `pending_user_requests.username`, `pending_user_requests.email`

## Alur Eksekusi (Approval)
1. User submit request -> insert ke `pending_user_requests` status `pending`.
2. Superadmin approve:
   - create row di `users`
   - update row pending menjadi `approved`
   - isi metadata approver
   - tulis audit log.
3. Superadmin reject:
   - update status `rejected`
   - simpan alasan reject
   - tulis audit log.

## Titik Rawan Error
- Bentrok unique key (username/email sudah dipakai di users atau pending).
- Endpoint approve/reject diakses non-superadmin -> `403`.
- Data pending hilang saat approve (ID stale di UI).

## Checklist Troubleshooting
1. Validate status request:
   - pastikan record ada dan status `pending`.
2. Validate role user yang eksekusi:
   - harus `superadmin`.
3. Jika approve gagal:
   - cek duplicate key di tabel `users`.
4. Konfirmasi audit event terbuat untuk trace.

## Query Debug SQL
```sql
SELECT id, username, email, status, requested_role, approved_role, updated_at
FROM pending_user_requests
ORDER BY updated_at DESC
LIMIT 30;

SELECT id, username, email, role, created_at
FROM users
ORDER BY created_at DESC
LIMIT 30;
```

## Related Docs
- [Technical Index](README.md)
- [Feature: User Management](../features/user-management.md)
- [Project README](../../README.md)

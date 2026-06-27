# Audit Logging Technical Notes

## Code Path Utama
- Helper insert event: `src/lib/audit`
- tRPC router: `src/server/trpc/routers/auditLogs.ts` (`auditLogs.list`)
- Statistik: `auditLogs.stats` (queries paralel via Promise.all)
- Proteksi role: `requireSuperAdmin` dari `src/lib/auth`

## Alur Eksekusi
1. Endpoint bisnis memanggil `logAuditEvent(...)`.
2. Data event disimpan ke tabel `audit_logs`.
3. Dashboard logs (`/api/audit-logs`) mendukung filter:
   - `action`, `resource_type`, `username`, `start_date`, `end_date`.
4. Dashboard stats (`/api/audit-logs/stats`) mengagregasi:
   - top action
   - top resource type
   - daily activity
   - top users.

## SQL dan Data Kunci
- Tabel `audit_logs`: `user_id`, `username`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `user_agent`, `created_at`.
- Query stats membedakan SQL date filter untuk PostgreSQL/MySQL.

## Titik Rawan Error
- User non-superadmin akses endpoint audit -> `403`.
- Data log tidak muncul karena filter date terlalu sempit.
- Volume log besar menyebabkan query lambat tanpa index tepat.

## Checklist Troubleshooting
1. Jalankan event test (mis. login sukses/gagal).
2. Query langsung tabel `audit_logs`.
3. Test endpoint:
   - `/api/audit-logs?page=1&limit=50`
   - `/api/audit-logs/stats?days=30`.
4. Jika kosong, cek timezone dan format tanggal filter.

## Query Debug SQL
```sql
SELECT id, username, action, resource_type, details, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;
```

## Related Docs
- [Technical Index](README.md)
- [Feature: Audit Logging](../features/audit-logging.md)
- [Project README](../../README.md)

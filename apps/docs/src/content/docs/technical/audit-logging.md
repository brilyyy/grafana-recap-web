---
title: Audit Logging
description: Audit log schema and implementation details.
---

## Main Code Path

- Helper insert event: `src/lib/audit`
- tRPC router: `src/server/trpc/routers/auditLogs.ts` (`auditLogs.list`)
- Statistics: `auditLogs.stats` (parallel queries via Promise.all)
- Role protection: `requireSuperAdmin` from `src/lib/auth`

## Execution Flow

1. Business endpoint calls `logAuditEvent(...)`.
2. Event data saved to `audit_logs` table.
3. Dashboard logs (`auditLogs.list`) supports filtering:
   - `action`, `resource_type`, `username`, `start_date`, `end_date`.
4. Dashboard stats (`auditLogs.stats`) aggregates:
   - top action
   - top resource type
   - daily activity
   - top users.

## Key SQL and Data

- Table `audit_logs`: `user_id`, `username`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `user_agent`, `created_at`.
- Stats query uses PostgreSQL date filtering.

## Error-Prone Points

- Non-superadmin accessing audit endpoint -> `403`.
- Logs not appearing due to overly narrow date filter.
- High log volume causing slow queries without proper indexes.

## Checklist Troubleshooting

1. Trigger a test event (e.g. successful/failed login).
2. Query `audit_logs` table directly.
3. Test endpoints:
   - `auditLogs.list({ page: 1, limit: 50 })`
   - `auditLogs.stats({ days: 30 })`.
4. If empty, check timezone and date filter format.

## Query Debug SQL

```sql
SELECT id, username, action, resource_type, details, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;
```

## Related Docs

- [Feature: Audit Logging](/features/audit-logging)

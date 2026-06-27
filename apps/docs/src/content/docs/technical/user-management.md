---
title: User Management
description: User management implementation details.
---

## Main Code Path

- Submit request: tRPC `auth.submitUserRequest` (`src/server/trpc/routers/auth.ts`)
- List pending request: tRPC `auth.pendingRequests`
- Approve request: tRPC `auth.approveRequest`
- Reject request: tRPC `auth.rejectRequest`
- Create user/admin directly: tRPC `users.create` (`src/server/trpc/routers/users.ts`), `auth.createAdmin`

## Key Data Structures

- `pending_user_requests`: registration queue.
- `users`: active accounts.
- Important unique constraints:
  - `users.username`, `users.email`
  - `pending_user_requests.username`, `pending_user_requests.email`

## Execution Flow (Approval)

1. User submits request -> insert into `pending_user_requests` with status `pending`.
2. Superadmin approves:
   - create row in `users`
   - update pending row to `approved`
   - fill approver metadata
   - write audit log.
3. Superadmin rejects:
   - update status to `rejected`
   - save rejection reason
   - write audit log.

## Error-Prone Points

- Unique key collision (username/email already used in users or pending).
- Approve/reject endpoint accessed by non-superadmin -> `403`.
- Pending data stale at approval time (stale ID in UI).

## Checklist Troubleshooting

1. Validate request status:
   - ensure record exists and status is `pending`.
2. Validate executing user role:
   - must be `superadmin`.
3. If approval fails:
   - check for duplicate key in `users` table.
4. Confirm audit event was created for traceability.

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

- [Feature: User Management](/features/user-management)

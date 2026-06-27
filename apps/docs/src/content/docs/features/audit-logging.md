---
title: Audit Logging
description: Track critical user and system actions for governance and troubleshooting.
---

## Purpose

Track critical user and system actions for governance and troubleshooting.

## Main Function

- Persist security and workflow events.
- Expose logs and aggregated stats to superadmin users.

## Flow Summary

- API/middleware emits audit event.
- Event is stored with actor and request metadata.
- Dashboard APIs return filtered logs and summary metrics.

## APIs

- tRPC `auditLogs.list` — paginated log query with filters
- tRPC `auditLogs.stats` — aggregated stats (top actions, daily activity)

## Related Docs

- [Technical: Audit Logging](/technical/audit-logging)

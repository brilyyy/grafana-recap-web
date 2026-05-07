# Audit Logging

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
- `/api/audit-logs`
- `/api/audit-logs/stats`

## Related Docs
- [Feature Index](README.md)
- [Technical Audit Notes](../technical/audit-logging.md)
- [Project README](../../README.md)

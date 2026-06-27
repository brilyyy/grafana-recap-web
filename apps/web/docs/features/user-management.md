# User Management

## Purpose
Handle registration requests and superadmin approval or rejection workflow.

## Main Function
- User submits registration request.
- Superadmin reviews pending requests.
- Approved requests become active users.

## Flow Summary
- Registration is stored as pending.
- Superadmin approves/rejects with audit trail.
- Approved user can log in and access permitted features.

## APIs
- `/api/register`
- `/api/pending-user-requests/*`

## Related Docs
- [Feature Index](README.md)
- [Technical User Management Notes](../technical/user-management.md)
- [Project README](../../README.md)

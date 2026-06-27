---
title: User Management
description: Handle registration requests and superadmin approval or rejection workflow.
---

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

- tRPC `auth.submitUserRequest` — submit registration
- tRPC `auth.pendingRequests` — list pending approvals
- tRPC `auth.approveRequest` — approve registration
- tRPC `auth.rejectRequest` — reject registration
- tRPC `users.create` — create user directly (superadmin)
- tRPC `auth.createAdmin` — create admin directly (superadmin)

## Related Docs

- [Technical: User Management](/technical/user-management)

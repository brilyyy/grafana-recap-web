---
title: App Management
description: Manage the list of monitored applications used by uploads, mapping, and reporting.
---

## Purpose

Manage the list of monitored applications used by uploads, mapping, and reporting.

## Main Function

- Create and list application identifiers.
- Ensure app-level isolation for dictionary and success-rate processing.

## Flow Summary

- Admin creates application record.
- App identifier becomes key reference in uploads and processing pipelines.

## APIs

- tRPC `applications.list` — list all apps
- tRPC `applications.create` — create new app
- tRPC `applications.updateConfig` — update app config

## Related Docs

- [Technical: App Management](/technical/app-management)

---
title: Dashboard
description: Application summary and overview dashboard.
---

## Purpose

Landing page showing per-application success-rate overview, processing activity, and quick links to other features.

## Main Function

- Display aggregate stats per application (total transactions, SR %, error breakdown).
- Show recent processing log entries across all apps.
- Navigate to detailed views (transactions, unmapped RC, dictionary) per app.

## APIs

- tRPC `applications.list` — list all applications
- tRPC `processingLogs.list` — recent processing activity

## Related Docs

- [Technical: Processing Logs](/technical/processing-logs)

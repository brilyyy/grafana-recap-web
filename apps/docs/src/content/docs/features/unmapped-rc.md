---
title: Unmapped RC Handling
description: Resolve RC entries that are not found in dictionary mappings.
---

## Purpose

Resolve RC entries that are not found in dictionary mappings.

## Main Function

- View unmapped RC records.
- Submit single or batch mappings.
- Backfill `app_success_rate.error_type` and clean up resolved entries.

## Flow Summary

- Operator assigns error type for unmapped RC.
- System updates dictionary and success-rate records.
- Resolved records are removed from `unmapped_rc`.

## APIs

- tRPC `unmappedRc.list` — list unmapped records
- tRPC `unmappedRc.submit` — map single record with error type
- tRPC `unmappedRc.submitBatch` — batch mapping

## Related Docs

- [Technical: Unmapped RC](/technical/unmapped-rc)

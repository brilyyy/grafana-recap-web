---
title: Success Rate Upload
description: Ingest transaction recap files and classify each record into success/error groups.
---

## Purpose

Ingest transaction recap files and classify each record into success/error groups.

## Main Function

- Parse upload file rows (`.xlsx` or `.csv` only).
- Normalize RC values: empty RC + status/desc "Sukses" → RC `00`, `error_type='Sukses'`.
- Map records using dictionary exact match (single batched lookup per upload).

## Flow Summary

- Validate all rows first (date, numeric fields, required columns); any bad row rejects the whole upload with a per-row reason list.
- Insert into `app_success_rate` (batched, transactional).
- Send unmatched RC records to `unmapped_rc`; rows without RC appear on the Transactions page.

## APIs

- API `POST /api/upload-success-rate` — file upload endpoint
- tRPC `uploads.*` — upload management procedures

## Related Docs

- [Technical: Success Rate Upload](/technical/success-rate-upload)
- [Operations: Success Rate SQL](/operations/success-rate-sql)

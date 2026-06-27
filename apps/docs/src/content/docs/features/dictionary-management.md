---
title: Dictionary Management
description: Manage response code dictionary that maps RC values into business error categories.
---

## Purpose

Manage response code dictionary that maps RC values into business error categories.

## Main Function

- Upload dictionary files.
- Update error type and RC description.
- Auto-remap matching records from `unmapped_rc`.

## Flow Summary

- Validate upload rows.
- Upsert dictionary rows by `(app, jenis_transaksi, rc)`.
- Remap unresolved entries when exact matches become available.

## APIs

- tRPC `dictionary.updateErrorType` — update single entry error type
- tRPC `dictionary.updateDescription` — update RC description
- tRPC `dictionary.updateDescriptionBatch` — batch update descriptions
- API `POST /api/upload-dictionary` — file upload (CSV/Excel)

## Related Docs

- [Technical: Dictionary Management](/technical/dictionary-management)

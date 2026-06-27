---
title: Uploads
description: Import dictionary and success-rate data from Excel or CSV files.
---

## Purpose

Single page for importing dictionary mappings and success-rate transaction data from Excel (`.xlsx`) or CSV files.

## Main Function

- Upload dictionary files to populate `response_code_dictionary`.
- Upload success-rate files to populate `app_success_rate`.
- View upload history and per-row validation results.

## Flow Summary

- Select file and target application.
- System validates headers, dates, and required fields.
- Errors reported per-row; any invalid row rejects the entire upload.
- Dictionary uploads auto-remap previously unmapped RC records.

## APIs

- API `POST /api/upload-dictionary` — dictionary file upload
- API `POST /api/upload-success-rate` — success-rate file upload
- tRPC `uploads.*` — upload management

## Related Docs

- [Feature: Success Rate Upload](/features/success-rate-upload)
- [Feature: Dictionary Management](/features/dictionary-management)
- [Technical: Uploads](/technical/uploads)

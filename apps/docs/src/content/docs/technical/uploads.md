---
title: Uploads
description: File upload processing for dictionary and success-rate data.
---

## Main Code Path

- Upload tRPC router: `src/server/trpc/routers/uploads.ts` (`uploads.uploadDictionary`, `uploads.uploadSuccessRate`)
- Dictionary processor: `src/server/uploads/dictionary.ts` (`processDictionaryUpload`)
- SR processor: `src/server/uploads/success-rate.ts` (`processSuccessRateUpload`)
- File parser: `src/lib/file-parser.ts`

## Execution Flow

1. Client sends `FormData` with file + `selectedApplicationId` via tRPC upload procedure.
2. Router extracts file and metadata, calls the appropriate processor.
3. **Dictionary upload**:
   - Parse CSV/Excel rows.
   - Validate headers: `Jenis Transaksi`, `RC`, `S/N`.
   - Upsert into `response_code_dictionary` via `ON CONFLICT DO UPDATE`.
   - Auto-remap matching `unmapped_rc` entries.
4. **Success-rate upload**:
   - Parse rows, validate dates and required fields.
   - Normalize RC: empty + success status => RC `00`.
   - Insert into `app_success_rate`, unmapped entries into `unmapped_rc`.

## Validation Rules

- All rows validated before any insert (fail-fast).
- Invalid rows returned as `skippedRows` in response with per-row reasons.
- File format: CSV (semicolon-comma flexible) or Excel (`.xlsx`).

## Error-Prone Points

- Header column mismatch (typo, case, or missing columns).
- Invalid date format (must be `DD/MM/YYYY` or `YYYY-MM-DD`).
- Large files causing connection timeouts — chunked processing recommended.

## Related Docs

- [Feature: Uploads](/features/uploads)
- [Technical: Dictionary Management](/technical/dictionary-management)
- [Technical: Success Rate Upload](/technical/success-rate-upload)

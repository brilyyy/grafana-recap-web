---
title: App Mappings
description: App mapping schema and implementation details.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/appMappings.ts` (`appMappings.list`, `appMappings.create`, `appMappings.update`, `appMappings.delete`)
- Table schema: `src/db/schema/appMappings` (`app_mappings` table)

## Key Schema (`app_mappings`)

| Column | Type | Description |
|--------|------|-------------|
| `id_app_identifier` | int FK | References `app_identifier` |
| `generate_from` | varchar | `"db"` or `"excel"` — data source |
| `fields` | jsonb | Column mapping: internal_name → source column |
| `success_type_format` | jsonb | Error type values considered success |
| `error_type_format` | jsonb | `{ system_error: [...], business_error: [...] }` |
| `ignore_errors` | text[] | RC / RC descriptions to drop |
| `ignore_features` | text[] | Transaction features to drop |

## Execution Flow

1. Superadmin configures mapping fields, format lists, and ignore rules per app.
2. PPTX Generator uses mapping to classify transactions (success/system error/business error).
3. Mapping determines column header mapping for Excel imports and field names for DB queries.

## Error-Prone Points

- Missing `fields` mapping causes generator failures (column not found).
- Case mismatch in `error_type_format` leads to misclassification.
- Missing `generate_from` — default not specified, app won't appear in generator.

## Related Docs

- [PPTX Generator: Overview](/sr-generator/overview)
- [Feature: PPTX Generator](/features/generator)

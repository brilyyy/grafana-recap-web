# Dictionary Management

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
- `/api/upload-dictionary`
- `/api/dictionary`
- `/api/dictionary/update`
- `/api/dictionary/update-description`

## Related Docs
- [Feature Index](README.md)
- [Technical Dictionary Notes](../technical/dictionary-management.md)
- [Project README](../../README.md)

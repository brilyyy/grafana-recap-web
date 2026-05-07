# Success Rate Upload

## Purpose
Ingest transaction recap files and classify each record into success/error groups.

## Main Function
- Parse upload file rows.
- Normalize RC values (including auto-set `00` for success indicators).
- Map records using dictionary exact match.

## Flow Summary
- Validate input rows first.
- Insert into `app_success_rate`.
- Send unmatched RC records to `unmapped_rc`.

## APIs
- `/api/upload-success-rate`

## Related Docs
- [Feature Index](README.md)
- [Technical Success Rate Notes](../technical/success-rate-upload.md)
- [Success Rate SQL README](../../scripts/success_rate/README.md)
- [Project README](../../README.md)

# Unmapped RC Handling

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
- `/api/unmapped-rc`
- `/api/unmapped-rc/submit`
- `/api/unmapped-rc/submit-batch`

## Related Docs
- [Feature Index](README.md)
- [Technical Unmapped RC Notes](../technical/unmapped-rc.md)
- [Project README](../../README.md)

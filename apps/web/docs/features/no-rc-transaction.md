# No RC Transaction Handling

## Purpose
Handle transactions with empty RC so operators can complete classification.

## Main Function
- List records where `rc` and `error_type` are both null.
- Allow manual RC assignment per record or batch.

## Flow Summary
- Operator submits RC and optional description.
- System checks dictionary for immediate mapping.
- If unresolved, record is inserted into `unmapped_rc`.

## APIs
- `/api/no-rc-transaction`
- `/api/no-rc-transaction/submit`
- `/api/no-rc-transaction/submit-batch`

## Related Docs
- [Feature Index](README.md)
- [Technical No RC Notes](../technical/no-rc-transaction.md)
- [Project README](../../README.md)

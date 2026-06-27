---
title: No-RC Transaction Handling
description: Handle transactions with empty RC so operators can complete classification.
---

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

- tRPC `noRcTransaction.list` — list null-RC records
- tRPC `noRcTransaction.submit` — assign RC to single record
- tRPC `noRcTransaction.submitBatch` — batch RC assignment

## Related Docs

- [Technical: No-RC Transaction](/technical/no-rc-transaction)

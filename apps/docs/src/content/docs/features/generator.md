---
title: PPTX Generator
description: Generate success-rate PowerPoint reports from the dashboard.
---

## Purpose

Generate PowerPoint (`.pptx`) reports from transaction success-rate data, accessible directly from the web dashboard.

## Main Function

- Select application and date range for the report.
- Configure mapping settings (error type formats, ignore lists).
- Trigger generation and download completed reports.

## APIs

- tRPC `generator.listMappings` — list available app mappings
- tRPC `generator.triggerGenerate` — trigger report generation
- tRPC `generator.listReports` — list generated reports
- tRPC `generator.deleteReport` — delete a generated report

## Related Docs

- [PPTX Generator: Overview](/sr-generator/overview)
- [PPTX Generator: Data Pipeline](/sr-generator/pipeline)
- [PPTX Generator: API & Setup](/sr-generator/api)

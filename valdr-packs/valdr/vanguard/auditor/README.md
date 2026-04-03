# Valdr Auditor Pack

## Canonical auditor

The canonical auditor is **Tyr v2**. Use this for all new audits:

- Directory: `valdr-packs/valdr/valdr/auditor/tyr-v2/`
- Purpose: evidence-backed Score Audit ingestion via `pm_audit action=context` → `pm_audit action=events` → `pm_audit action=score`

## Deprecated

`valdr-packs/valdr/valdr/auditor/tyr/` is deprecated (legacy JSON audit flow). Do not use it for new audits. It will be deleted once Tyr v2 is validated end-to-end.

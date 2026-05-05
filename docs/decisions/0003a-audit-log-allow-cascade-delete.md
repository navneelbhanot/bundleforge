# ADR-0003a — Allow cascade DELETE on inventory_audit_log

- **Status:** accepted
- **Date:** 2026-05-04
- **Deciders:** Claude Code session 0030, user
- **Supersedes:** delete-blocking portion of ADR-0003

---

## Context

ADR-0003 prescribed BEFORE-UPDATE and BEFORE-DELETE triggers on
`inventory_audit_log` to make the table append-only. M-030 (GDPR
`shop/redact`) requires cascade-deleting all shop-owned data, including
audit log rows. The DELETE trigger blocks this.

## Decision

Drop the BEFORE-DELETE trigger. Retain the BEFORE-UPDATE trigger.

The integrity threat ADR-0003 was defending against is *silent
mutation* of historical inventory records — the failure mode that
plagues Simple Bundles. That risk is bounded by UPDATE protection.
DELETE during a Shopify-mandated GDPR redaction is operationally
required and is not the same as "an attacker rewriting history."

## Consequences

- Positive: shop/redact cascades cleanly; no special-case path in code.
- Negative: an attacker with database write access could DELETE rows,
  but they could already do far worse damage (drop tables, etc.).
  Defense in depth here is database-role-level RBAC, M-140 territory.

## Follow-ups

- M-030 implements the handler.
- Migration `20260504_audit_log_relax_delete` drops the trigger.
- M-140 (security review) revisits role-level grants.

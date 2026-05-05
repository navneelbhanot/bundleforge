-- ADR-0003a: relax inventory_audit_log immutability to UPDATE-only.
--
-- DELETE was originally blocked alongside UPDATE. GDPR shop/redact (M-030)
-- requires cascade deletion of all shop-owned data, which the original
-- trigger blocked. The integrity threat ADR-0003 cares about is *silent
-- mutation* of historical records (the Simple Bundles inventory-reset bug),
-- not *required* removal during a redaction. UPDATE protection is retained.

DROP TRIGGER IF EXISTS inventory_audit_log_no_delete ON "inventory_audit_log";

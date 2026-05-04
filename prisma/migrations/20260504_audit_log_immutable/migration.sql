-- =============================================================================
-- ADR-0003: inventory_audit_log is immutable.
-- =============================================================================
-- Use a trigger to reject UPDATE and DELETE on the audit table at the
-- database level. We cannot rely on per-role REVOKE without knowing the
-- runtime role name (varies by host). A trigger that inspects no role at all
-- is universally enforceable.
-- =============================================================================

CREATE OR REPLACE FUNCTION inventory_audit_log_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'inventory_audit_log is append-only (ADR-0003); attempted % rejected', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS inventory_audit_log_no_update ON "inventory_audit_log";
CREATE TRIGGER inventory_audit_log_no_update
  BEFORE UPDATE ON "inventory_audit_log"
  FOR EACH ROW EXECUTE FUNCTION inventory_audit_log_immutable();

DROP TRIGGER IF EXISTS inventory_audit_log_no_delete ON "inventory_audit_log";
CREATE TRIGGER inventory_audit_log_no_delete
  BEFORE DELETE ON "inventory_audit_log"
  FOR EACH ROW EXECUTE FUNCTION inventory_audit_log_immutable();

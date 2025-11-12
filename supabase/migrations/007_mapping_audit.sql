/**
 * Sprint 3: Mapping Tables - Audit Logging
 *
 * Track all changes to mapping tables for compliance and debugging
 */

-- ============================================================================
-- Audit logging trigger (generic)
-- ============================================================================

-- Log trigger function (should already exist from Sprint 1, but ensure it handles new tables)
-- This updates the existing log_audit() function to handle mapping tables

CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  -- Get current user (session auth.uid or system)
  v_actor_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  -- Prepare data based on operation
  CASE TG_OP
    WHEN 'INSERT' THEN
      v_old_data := NULL;
      v_new_data := to_jsonb(NEW);
    WHEN 'UPDATE' THEN
      v_old_data := to_jsonb(OLD);
      v_new_data := to_jsonb(NEW);
    WHEN 'DELETE' THEN
      v_old_data := to_jsonb(OLD);
      v_new_data := NULL;
  END CASE;

  -- Insert audit log
  INSERT INTO audit_logs (tenant_id, user_id, action, table_name, record_id, old_data, new_data, created_at)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),  -- Get tenant_id from new or old row
    v_actor_id,
    TG_OP::audit_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_old_data,
    v_new_data,
    NOW()
  );

  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Audit triggers for mapping tables
-- ============================================================================

-- dpgf_mappings
CREATE TRIGGER audit_dpgf_mappings_insert
AFTER INSERT ON dpgf_mappings
FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_dpgf_mappings_update
AFTER UPDATE ON dpgf_mappings
FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_dpgf_mappings_delete
AFTER DELETE ON dpgf_mappings
FOR EACH ROW EXECUTE FUNCTION log_audit();

-- mapping_memory
CREATE TRIGGER audit_mapping_memory_insert
AFTER INSERT ON mapping_memory
FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_mapping_memory_update
AFTER UPDATE ON mapping_memory
FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_mapping_memory_delete
AFTER DELETE ON mapping_memory
FOR EACH ROW EXECUTE FUNCTION log_audit();

-- mapping_templates
CREATE TRIGGER audit_mapping_templates_insert
AFTER INSERT ON mapping_templates
FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_mapping_templates_update
AFTER UPDATE ON mapping_templates
FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_mapping_templates_delete
AFTER DELETE ON mapping_templates
FOR EACH ROW EXECUTE FUNCTION log_audit();

-- ============================================================================
-- Automatic timestamp update triggers
-- ============================================================================

-- dpgf_mappings: update 'updated_at' on modification
CREATE OR REPLACE FUNCTION update_dpgf_mappings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dpgf_mappings_update_timestamp
BEFORE UPDATE ON dpgf_mappings
FOR EACH ROW EXECUTE FUNCTION update_dpgf_mappings_timestamp();

-- mapping_templates: update 'updated_at' on modification
CREATE OR REPLACE FUNCTION update_mapping_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mapping_templates_update_timestamp
BEFORE UPDATE ON mapping_templates
FOR EACH ROW EXECUTE FUNCTION update_mapping_templates_timestamp();

-- ============================================================================
-- View for audit queries (helper for debugging)
-- ============================================================================

CREATE OR REPLACE VIEW mapping_audit_log AS
SELECT
  al.id,
  al.tenant_id,
  al.user_id,
  al.action,
  al.table_name,
  al.record_id,
  al.old_data,
  al.new_data,
  al.created_at,
  -- Enrich with user info if available
  p.full_name as actor_name
FROM audit_logs al
LEFT JOIN profiles p ON al.user_id = p.id
WHERE al.table_name IN ('dpgf_mappings', 'mapping_memory', 'mapping_templates', 'dpgf_imports')
ORDER BY al.created_at DESC;

COMMENT ON VIEW mapping_audit_log IS 'View for querying audit logs related to mapping operations';

-- ============================================================================
-- Cleanup routine for old audit logs (optional, runs manually)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_mapping_audits(p_days_old integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM audit_logs
  WHERE
    table_name IN ('dpgf_mappings', 'mapping_memory', 'mapping_templates')
    AND created_at < NOW() - (p_days_old || ' days')::interval;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_mapping_audits(integer) IS 'Purge mapping audit logs older than N days (default 90)';

-- ============================================================================
-- Statistics helper: view for mapping activity
-- ============================================================================

CREATE OR REPLACE VIEW mapping_activity_summary AS
SELECT
  tenant_id,
  DATE_TRUNC('day', created_at) as day,
  table_name,
  action,
  COUNT(*) as count
FROM audit_logs
WHERE table_name IN ('dpgf_mappings', 'mapping_memory', 'mapping_templates')
GROUP BY tenant_id, DATE_TRUNC('day', created_at), table_name, action
ORDER BY day DESC, table_name, action;

COMMENT ON VIEW mapping_activity_summary IS 'Daily activity stats for mapping operations';

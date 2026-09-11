-- Microfixd final governed-control extension.
-- Adds durable evidence types for self-healing, full-system audit, and constitution/doctrine/Paragon lock posture.
-- This migration is additive and preserves all prior Layer-0 through Layer-17 evidence types.

ALTER TABLE public.microfixd_level6_records
  DROP CONSTRAINT IF EXISTS microfixd_level6_records_record_type_check;

ALTER TABLE public.microfixd_level6_records
  ADD CONSTRAINT microfixd_level6_records_record_type_check CHECK (record_type IN (
    'tenant',
    'agent',
    'agent_execution',
    'repair_proposal',
    'compute_profile',
    'change_request',
    'safe_mode',
    'workflow_template',
    'organ_boot',
    'organ_health',
    'organ_wiring',
    'cognitive_map',
    'cognitive_assessment',
    'memory_assessment',
    'execution_assessment',
    'evolution_assessment',
    'infrastructure_assessment',
    'health_assessment',
    'audit_assessment',
    'governance_lock'
  ));

CREATE INDEX IF NOT EXISTS microfixd_level6_tenant_type_updated_idx
  ON public.microfixd_level6_records (tenant_id, record_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS microfixd_level6_governance_evidence_idx
  ON public.microfixd_level6_records (record_type, tenant_id, name)
  WHERE record_type IN ('health_assessment', 'audit_assessment', 'governance_lock');

-- Microfixd full-manual Layer-0 through Layer-7 extension.
-- Adds explicit registry metadata and durable lifecycle, cognitive, memory, execution, evolution, and infrastructure evidence without removing existing governed state.

ALTER TABLE public.microfixd_organ_registry
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.microfixd_memory_records
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'global';

ALTER TABLE public.microfixd_level6_records
  DROP CONSTRAINT IF EXISTS microfixd_level6_records_record_type_check;

ALTER TABLE public.microfixd_level6_records
  ADD CONSTRAINT microfixd_level6_records_record_type_check CHECK (record_type IN (
    'tenant','agent','agent_execution','repair_proposal','compute_profile','change_request','safe_mode','workflow_template',
    'organ_boot','organ_health','organ_wiring','cognitive_map','cognitive_assessment','memory_assessment',
    'execution_assessment','evolution_assessment','infrastructure_assessment'
  ));

CREATE INDEX IF NOT EXISTS microfixd_organ_metadata_gin_idx
  ON public.microfixd_organ_registry USING GIN (metadata);
CREATE INDEX IF NOT EXISTS microfixd_level6_record_name_idx
  ON public.microfixd_level6_records (record_type, name, updated_at DESC);
CREATE INDEX IF NOT EXISTS microfixd_memory_tenant_agent_created_idx
  ON public.microfixd_memory_records (tenant_id, agent_id, created_at DESC);

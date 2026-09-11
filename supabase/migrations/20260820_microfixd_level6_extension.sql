-- Microfixd Level-6 extension: additive tenant, agent, repair, compute, source-control, and versioned-organ schema.
-- This migration preserves existing governed records and defaults legacy rows to the global tenant.

ALTER TABLE public.microfixd_runtime_runs
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'global';

ALTER TABLE public.microfixd_organ_registry
  ADD COLUMN IF NOT EXISTS layer INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '2.0.0';

ALTER TABLE public.microfixd_organ_registry
  DROP CONSTRAINT IF EXISTS microfixd_organ_registry_family_number_check;

ALTER TABLE public.microfixd_organ_registry
  ADD CONSTRAINT microfixd_organ_registry_family_number_check CHECK (family_number BETWEEN 1 AND 21);

ALTER TABLE public.microfixd_organ_registry
  ADD CONSTRAINT microfixd_organ_registry_layer_check CHECK (layer BETWEEN 0 AND 7) NOT VALID;

CREATE TABLE IF NOT EXISTS public.microfixd_level6_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('tenant','agent','agent_execution','repair_proposal','compute_profile','change_request','safe_mode','workflow_template')),
  tenant_id TEXT NOT NULL DEFAULT 'global',
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS microfixd_level6_type_tenant_updated_idx
  ON public.microfixd_level6_records (record_type, tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS microfixd_runs_tenant_created_idx
  ON public.microfixd_runtime_runs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS microfixd_organ_layer_family_idx
  ON public.microfixd_organ_registry (layer, family_number, id);

ALTER TABLE public.microfixd_level6_records ENABLE ROW LEVEL SECURITY;

-- Browser roles receive no direct policies. The application server uses a protected database role.

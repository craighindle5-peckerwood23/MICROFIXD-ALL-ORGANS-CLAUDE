-- Microfixd governed synthetic system: additive production schema.
-- This migration intentionally creates new namespaced tables and does not alter legacy microfyxd tables.

CREATE TABLE IF NOT EXISTS public.microfixd_runtime_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('queued','planning','running','awaiting_approval','succeeded','failed','cancelled')),
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_step INTEGER NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  working_memory JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.microfixd_runtime_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES public.microfixd_runtime_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  action JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','blocked','denied','failed')),
  policy JSONB,
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.microfixd_memory_records (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  run_id TEXT REFERENCES public.microfixd_runtime_runs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('episodic','semantic','procedural','experience')),
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  importance DOUBLE PRECISION NOT NULL CHECK (importance >= 0 AND importance <= 1),
  score DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.microfixd_governance_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  action_kind TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('low','medium','high','critical')),
  outcome TEXT NOT NULL CHECK (outcome IN ('allow','require_approval','deny')),
  reasons JSONB NOT NULL,
  evidence JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.microfixd_approval_requests (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES public.microfixd_runtime_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  action JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  decision_note TEXT
);

CREATE TABLE IF NOT EXISTS public.microfixd_integration_audits (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  route_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('cache_hit','sent','fallback','blocked','awaiting_approval','failed')),
  estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  actual_cost_usd DOUBLE PRECISION CHECK (actual_cost_usd >= 0),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  response_status INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.microfixd_organ_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  family_number INTEGER NOT NULL CHECK (family_number BETWEEN 1 AND 15),
  tier TEXT NOT NULL CHECK (tier IN ('tier-0','tier-1','tier-2')),
  mode TEXT NOT NULL CHECK (mode IN ('native','composed','adapter')),
  guided_path TEXT NOT NULL,
  final_authority TEXT NOT NULL DEFAULT 'Paragon Dissector',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.microfixd_organ_invocations (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  organ_id TEXT NOT NULL REFERENCES public.microfixd_organ_registry(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (operation IN ('status','describe','prepare')),
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed','awaiting_approval','denied')),
  decision_id TEXT NOT NULL REFERENCES public.microfixd_governance_decisions(id) ON DELETE RESTRICT,
  procedure JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.microfixd_phenotype_snapshots (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES public.microfixd_runtime_runs(id) ON DELETE SET NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.microfixd_system_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  organ_id TEXT REFERENCES public.microfixd_organ_registry(id) ON DELETE SET NULL,
  run_id TEXT REFERENCES public.microfixd_runtime_runs(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS microfixd_runtime_runs_status_created_idx ON public.microfixd_runtime_runs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS microfixd_runtime_steps_run_sequence_idx ON public.microfixd_runtime_steps (run_id, sequence);
CREATE INDEX IF NOT EXISTS microfixd_memory_agent_created_idx ON public.microfixd_memory_records (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS microfixd_memory_tags_gin_idx ON public.microfixd_memory_records USING GIN (tags);
CREATE INDEX IF NOT EXISTS microfixd_governance_run_created_idx ON public.microfixd_governance_decisions (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS microfixd_approvals_status_requested_idx ON public.microfixd_approval_requests (status, requested_at);
CREATE INDEX IF NOT EXISTS microfixd_integration_run_created_idx ON public.microfixd_integration_audits (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS microfixd_events_created_idx ON public.microfixd_system_events (created_at DESC);

-- Browser clients do not access these tables directly. The application uses a server-side database role.
ALTER TABLE public.microfixd_runtime_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_runtime_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_memory_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_governance_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_integration_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_organ_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_organ_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_phenotype_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_system_events ENABLE ROW LEVEL SECURITY;

-- The absence of public policies is intentional: unauthenticated and browser roles have no table access.

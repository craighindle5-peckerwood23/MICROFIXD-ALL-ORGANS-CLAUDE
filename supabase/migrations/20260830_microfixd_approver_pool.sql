-- Adds real two-distinct-admin approval tracking, matching
-- src/autonomy/store.ts's PostgresRuntimeStore table definition exactly.
-- Additive-only: existing rows get approved_by = '[]', preserving current
-- single-decision behavior for any approval already in flight.

ALTER TABLE IF EXISTS public.microfixd_approval_requests
  ADD COLUMN IF NOT EXISTS approved_by JSONB NOT NULL DEFAULT '[]'::jsonb;

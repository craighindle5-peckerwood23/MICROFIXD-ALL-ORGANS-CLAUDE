-- Microfixd usage/lineage tracking: a durable, queryable, tenant-scoped record of
-- what happened, by whom, and what data it touched.
--
-- This is additive-only and matches src/autonomy/store.ts's PostgresRuntimeStore
-- table creation exactly, so a fresh production database (via store initialize())
-- and a pre-existing one migrated with this file end up with the same schema.
--
-- Scope note: this is a flat event log with a `data_refs` array of opaque
-- identifiers (run ids, upload ids, organ ids, plugin ids) -- accurate lineage
-- for "what touched X", not a full relational provenance graph. Treat it as an
-- audit log with tags, not a data-lineage product.

CREATE TABLE IF NOT EXISTS public.microfixd_usage_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'global',
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  run_id TEXT,
  actor_id TEXT,
  data_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS microfixd_usage_events_tenant_created
  ON public.microfixd_usage_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS microfixd_usage_events_kind_idx
  ON public.microfixd_usage_events (kind);

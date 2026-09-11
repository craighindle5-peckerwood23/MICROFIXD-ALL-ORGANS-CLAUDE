#!/usr/bin/env bash
# scripts/export-golden-snapshot.sh
#
# Real golden-clone export: runtime config, Docker image, DB dump,
# vector snapshot (if pgvector is installed), and the pinned model
# registry -- everything needed to prove two deployments are running
# identical logic and identical models.
#
# Honest notes, checked against the real repo before writing this:
#   - There is no runtime-config.yaml in this repo. The real
#     equivalents are compose.yaml and render.yaml -- both exported.
#   - The real memory table is public.microfixd_memory_records
#     (confirmed in supabase/migrations/20260820_microfixd_governed_system.sql).
#     There is no "learned_outcomes" table -- that name doesn't exist
#     in this schema.
#   - pgvector is available in the connected Supabase project but not
#     yet installed (confirmed earlier this session) -- the vector
#     export step below will correctly report "not present" until
#     that changes, rather than failing or faking a CSV.
#   - This script has NOT been run end-to-end in this sandbox: no
#     Docker daemon is available here, and no DATABASE_URL/SUPABASE_DB_URL
#     is configured to a reachable Postgres from this shell. The logic
#     is real and matches your actual repo; running it against your
#     real deployment target is the next real step, not done here.

set -euo pipefail

OUTDIR="${1:-/tmp/microfixd-golden-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUTDIR"
echo "Exporting golden snapshot to $OUTDIR"

# 1. Runtime config -- the real files, not a fictional runtime-config.yaml
for f in compose.yaml render.yaml package.json package-lock.json; do
  if [ -f "$f" ]; then
    cp -v "$f" "$OUTDIR/"
  else
    echo "note: $f not found, skipping"
  fi
done

# 2. Docker image save (requires a local Docker daemon and a built image tag)
IMAGE_TAG="${IMAGE_TAG:-microfixd:latest}"
if command -v docker >/dev/null 2>&1; then
  if docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
    docker save -o "$OUTDIR/microfixd-image.tar" "$IMAGE_TAG"
    echo "Docker image saved."
  else
    echo "note: image $IMAGE_TAG not found locally (build it with: docker build -t $IMAGE_TAG .). Skipping image export."
  fi
else
  echo "note: docker not available in this environment. Skipping image export."
fi

# 3. Postgres dump -- uses SUPABASE_DB_URL first (the real var name in
# .env.example), falls back to DATABASE_URL for portability.
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "note: SUPABASE_DB_URL/DATABASE_URL not set. Skipping DB dump."
else
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump --format=custom --file="$OUTDIR/db.dump" "$DB_URL"
    echo "Postgres dump written."
  else
    echo "note: pg_dump not installed in this environment. Skipping DB dump."
  fi
fi

# 4. pgvector snapshot -- real table name, real graceful skip if the
# extension isn't installed (it isn't, as of this writing).
if [ -n "$DB_URL" ] && command -v psql >/dev/null 2>&1; then
  if psql "$DB_URL" -tAc "SELECT 1 FROM pg_extension WHERE extname='vector';" 2>/dev/null | grep -q 1; then
    echo "pgvector extension present; exporting embedding columns from microfixd_memory_records."
    psql "$DB_URL" -c "\copy (SELECT id, tenant_id, embedding FROM public.microfixd_memory_records WHERE embedding IS NOT NULL) TO '$OUTDIR/microfixd_memory_embeddings.csv' WITH CSV HEADER" \
      || echo "note: embedding column may not exist yet even though pgvector is installed -- check the actual memory_records schema before relying on this export."
  else
    echo "note: pgvector extension not installed on this database. No vector snapshot to export (this matches the known, confirmed state as of this session)."
  fi
else
  echo "note: skipping pgvector check (no DB_URL or psql unavailable)."
fi

# 5. Pinned model registry -- the real single source of truth for
# which models this deployment runs, so a clone diff can catch model
# drift immediately.
if [ -f src/autonomy/model-registry.ts ]; then
  cp -v src/autonomy/model-registry.ts "$OUTDIR/"
else
  echo "note: src/autonomy/model-registry.ts not found."
fi

# 6. Manifest
GIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
cat > "$OUTDIR/manifest.json" <<JSON
{
  "exportedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitSha": "$GIT_SHA",
  "imageTag": "$IMAGE_TAG",
  "runtimeConfigFiles": ["compose.yaml", "render.yaml"],
  "dbDump": "db.dump",
  "vectorCsv": "microfixd_memory_embeddings.csv",
  "modelRegistry": "model-registry.ts",
  "note": "Missing entries above mean that export step was skipped in this environment -- check the console output for why, not just this manifest."
}
JSON

echo ""
echo "Golden snapshot export finished: $OUTDIR"
echo "Contents:"
ls -la "$OUTDIR"

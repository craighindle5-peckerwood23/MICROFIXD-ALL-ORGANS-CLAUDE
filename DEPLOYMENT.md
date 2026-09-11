# Microfixd Portable Deployment Guide

Microfixd ships as one Docker image and one Node entrypoint: `node dist/server.cjs`. It listens on the host-provided `PORT`, exposes `/healthz`, `/readyz`, and `/metrics`, and uses Supabase Postgres as its production system of record. The image includes Chromium for an explicitly enabled local-console screenshot procedure; it captures only this service and blocks all non-local browser navigation. The application must receive secrets only through the target platform’s server-side secret or environment-variable facility.

> Do not commit `ADMIN_API_KEY`, `SUPABASE_DB_URL`, plugin credentials, provider tokens, or a populated `.env` file. The browser console never receives these values.

## Required Production Settings

| Setting | Purpose | Production requirement |
|---|---|---|
| `ADMIN_API_KEY` | Protects privileged goal, approval, integration, and organ-invocation endpoints. | Required. Use a long random secret in the hosting platform’s secret store. |
| `SUPABASE_DB_URL` | Server-side connection to the active `microfyxd` Supabase project. | Required when `REQUIRE_DURABLE_MEMORY=true`. |
| `REQUIRE_DURABLE_MEMORY` | Prevents a deployment from becoming ready on JSON-only local memory. | Set to `true`. |
| `MICROFIXD_EMERGENCY_STOP` | Immediately blocks mutating autonomous work while preserving non-mutating inspection. | Default `false`; set `true` during incident response. |
| `MICROFIXD_PLUGINS_JSON` | Defines allowlisted plugin manifests without credential values. | Optional. Credential references point to separately stored server variables. |
| `MICROFIXD_ENABLE_LOCAL_SCREENSHOTS` | Enables Puppeteer capture of Microfixd’s own local console. | Default `false`. Set `true` only in a trusted environment; non-local browser navigation is blocked. |
| `MICROFIXD_DEFAULT_TENANT` | Default tenant for internal compatibility paths. | Keep `global`; all customer work should submit an explicit tenant identifier. |
| `NVIDIA_VISIBLE_DEVICES` | Optional platform-provided GPU discovery signal. | Read-only discovery only; it does not enable GPU workload execution or billing. |

## Supabase Session Pooler for Microfixd

For a persistent Microfixd Node container running from an IPv4-only network, use Supabase’s **Shared Pooler in Session mode**. In the Supabase dashboard, open the target project, select **Connect**, choose **Session Pooler**, and copy the single PostgreSQL URI shown there. Store that complete URI in the deployment platform’s secret manager as `SUPABASE_DB_URL`; do not put it in Git, source, browser configuration, screenshots, logs, or an uploaded archive. Supabase documents Session Pooler as the IPv4-compatible option for persistent application backends; the direct database endpoint is IPv6 unless the project has the IPv4 add-on. [4]

For local development only, create an ignored `.env.local` file beside `.env.example` and add exactly one private setting:

```bash
SUPABASE_DB_URL='<paste-the-complete-session-pooler-uri-here>'
REQUIRE_DURABLE_MEMORY=true
```

Use the URI exactly as copied, retain the SSL query settings Supabase provides, and percent-encode special characters in the password. The runtime accepts `DATABASE_URL` as an equivalent portable alternative, but configure **one** of the two variables only. At deployment time, `GET /readyz` is production-ready only when it returns HTTP 200 with `storage.durable: true`; a JSON fallback or a failed ready check is not production-ready.

> Do not use a Supabase project URL or public/anon key for `SUPABASE_DB_URL`. Those are Data API credentials, not the PostgreSQL connection URI required by Microfixd’s durable runtime store.

## Railway

Railway detects a root `Dockerfile` and its configuration-as-code file. The included `railway.toml` explicitly selects the Dockerfile builder and makes deployment activation depend on the durable-memory readiness endpoint. Railway injects `PORT`, and its health checks use the same port, so Microfixd’s port-injection procedure is mandatory. [1] [2] [3]

Create a Railway service from this repository, set the required production settings in the service variables, attach no persistent volume, and deploy. Supabase holds durable state, allowing the service itself to remain stateless. The deploy will become active only when `GET /readyz` returns HTTP 200.

| Railway setting | Repository value |
|---|---|
| Builder | `DOCKERFILE` |
| Dockerfile | `Dockerfile` |
| Readiness path | `/readyz` |
| Health-check timeout | 300 seconds |
| Restart policy | `ON_FAILURE`, maximum 5 retries |

## Render

The root `render.yaml` is a Render Blueprint for the same Docker image used by Railway. In Render, select **New → Blueprint**, connect the Microfixd repository, and review the generated `microfixd-governed` web service. Render builds the root `Dockerfile`, supplies its own `PORT`, and waits for `GET /readyz` before treating the service as healthy. [5] [6]

When Render prompts for values marked as secrets, enter the following only in the Render dashboard:

| Render variable | Required value |
|---|---|
| `ADMIN_API_KEY` | A new long random operator secret. |
| `SUPABASE_DB_URL` | The single Supabase **Session Pooler** PostgreSQL URI. |

The Blueprint fixes `REQUIRE_DURABLE_MEMORY=true`; therefore the deployment will not become healthy until the Session Pooler connection works and durable storage reports true. Do not create a Render Postgres database or attach an application disk for the Microfixd system of record: the external Supabase project remains the durable authority. The Dockerfile’s own `CMD` starts the service, so no custom Docker command is required.

## GitHub Codespaces

The checked-in `.devcontainer/devcontainer.json` uses Node 22, forwards port 3000, and defaults durable-memory enforcement to `false` so a developer can run the system against the JSON fallback without copying production data. Add development-only values through Codespaces secrets or environment settings, then run `npm run dev`.

For a production-like Codespaces session, set `SUPABASE_DB_URL`, `ADMIN_API_KEY`, and `REQUIRE_DURABLE_MEMORY=true` in the Codespace’s protected environment before starting the service.

## Azure and GCP

Build the same Docker image on either platform; no code, manifest, or runtime branching is needed. Configure the container’s ingress port from `PORT` and inject the required settings from Azure Key Vault-backed container secrets or Google Secret Manager-backed Cloud Run secrets. Route startup checks to `/readyz` and liveness monitoring to `/healthz`.

| Platform | Recommended managed target | Entry command | Readiness endpoint |
|---|---|---|---|
| Azure | Azure Container Apps | `node dist/server.cjs` | `/readyz` |
| GCP | Cloud Run | `node dist/server.cjs` | `/readyz` |

## Local Container Validation

Export only local development values in the terminal environment, then use the supplied Compose profile:

```bash
export ADMIN_API_KEY='<set-a-local-secret-in-your-shell>'
export REQUIRE_DURABLE_MEMORY=false
docker compose up --build
```

Check `http://localhost:3000/healthz` for process liveness and `http://localhost:3000/readyz` for storage readiness. Do not treat local JSON mode as a production deployment.

## Level-6 Operational Boundaries

Microfixd exposes a 200-organ, eight-layer mission-control interface after the service is running. Its protected operations routes require both `ADMIN_API_KEY` and a valid `x-microfixd-tenant` header (or an explicit `tenantId` in the request). The global tenant exists for internal compatibility and does not weaken the Tier-0 constitution. Safe mode can be changed only through the protected operator API; it preserves inspection and evidence while halting non-inspection work.

Compute discovery is local and read-only. GPU/eGPU offload, distributed compute, clusters, web automation, browser use, GitHub, CI/CD, deployment, and external vehicle/device control are not enabled by a container variable or UI control. Each requires an approved Plugin Registry manifest, OmniRouter route, Paragon decision, cost/risk policy, and—when protected—Craig’s explicit approval. GitHub workflow support creates an audited change request; it does not create a PR, merge code, deploy, or roll back production by itself.

## Supabase Schema

The active `microfyxd` project contains the additive `microfixd_*` tables created by both `supabase/migrations/20260820_microfixd_governed_system.sql` and `supabase/migrations/20260820_microfixd_level6_extension.sql`. The system-of-record now includes the versioned 200-organ registry, Layer-0 through Layer-7 inventory, tenant-scoped runs, agent roles and handoffs, sandbox repair proposals, compute posture, change requests, safe mode, organ invocations, governed steps and decisions, approvals, memory and learning records, integration audits, phenotype snapshots, and system events. RLS is enabled and browser roles receive no direct policies.

## References

[1]: https://docs.railway.com/config-as-code/reference "Railway Config as Code Reference"
[2]: https://docs.railway.com/deployments/healthchecks "Railway Healthchecks"
[3]: https://docs.railway.com/builds/dockerfiles "Railway Dockerfiles"
[4]: https://supabase.com/docs/guides/database/connecting-to-postgres "Supabase: Connect to your Postgres database"
[5]: https://render.com/docs/blueprint-spec "Render Blueprint YAML Reference"
[6]: https://render.com/docs/docker "Render Docker Deployments"

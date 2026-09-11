# Microfixd

> **Governed synthetic operations platform.** Microfixd is a cloud-portable TypeScript service with a tenant-scoped mission-control UI, durable operational evidence, and **Paragon Dissector** as the non-bypassable Tier-0 policy authority.

Microfixd registers **200 organs across 21 families and eight foundational layers**. It implements bounded planning, tenant-isolated memory, governed execution, sandbox-only evolution candidates, OmniRouter-exclusive outbound routing, read-only compute posture, self-healing evidence, master wiring validation, final audit/lock posture, and deterministic first-boot records. The system does **not** claim that unconfigured third-party integrations, source code, cloud infrastructure, or future human changes are physically immutable or autonomously activated.

## Navigation

| Resource | Purpose |
|---|---|
| [COMPLETE_SYSTEM_SUMMARY.md](COMPLETE_SYSTEM_SUMMARY.md) | Registry-derived complete-organism map, all 200 organs, layer map, overlays, boundaries, and guided links. |
| [ORGANS.md](ORGANS.md) | Family-oriented 200-organ registry reference. |
| [LEVEL6_ARCHITECTURE.md](LEVEL6_ARCHITECTURE.md) | Eight foundational layers and enterprise overlays. |
| [WIRING_STATUS.md](WIRING_STATUS.md) | Declarative wiring and validation status. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker, Railway, Codespaces, Azure, and GCP deployment guidance. |
| [PRODUCTION_REQUIREMENTS.md](PRODUCTION_REQUIREMENTS.md) | Environment, durability, health, and operational prerequisites. |

## Core Operating Boundaries

| Boundary | Enforced behavior |
|---|---|
| **Tier-0 governance** | Every executable action requires a recorded Paragon decision. High-risk, high-cost, protected, uncertain, and external-effect work escalates to Craig. |
| **Outbound routing** | No external provider route is allowed outside **OmniRouter** and **Plugin Registry**. Security input screening runs before plugin routing. |
| **Tenant isolation** | Runs, memories, agents, approvals, workflow evidence, and posture records are tenant-scoped; cross-tenant access is rejected. |
| **Execution** | Web authority is **Puppeteer-only** and durable action evidence is recorded. |
| **Evolution and repair** | Evolution and repair produce sandbox-bound candidates and evidence. Activation, merge, deployment, restart, patch, replacement, or rollback requires the separately governed change path. |
| **Safe mode** | Safe mode halts non-inspection work without deleting durable evidence. |
| **Mission Control** | The holographic UI uses protected APIs and shows posture; it does not expose secrets or create an ungoverned activation path. |

## Quick Start

### Prerequisites

Install Node.js 22 or later. For production-grade durable memory, configure a PostgreSQL connection string for the designated Supabase project or another compatible PostgreSQL deployment.

```bash
npm install
cp .env.example .env
npm run dev
```

The service binds to the platform-provided `PORT` when present. Never commit a populated `.env` file.

### Required Production Environment

| Variable | Purpose |
|---|---|
| `ADMIN_API_KEY` | Protects Microfixd operator APIs. Supply only through the deployment platform’s secret manager. |
| `SUPABASE_DB_URL` or `DATABASE_URL` | PostgreSQL durable-system-of-record connection string. |
| `REQUIRE_DURABLE_MEMORY=true` | Prevents startup with JSON fallback when durable memory is required. |
| `MICROFIXD_ENABLE_LOCAL_SCREENSHOTS=false` | Keeps local screenshot capture disabled unless explicitly required. |
| `MICROFIXD_WATCHDOG_HEAP_LIMIT_PRESSURE=0.90` | Defines the V8 heap-pressure guard threshold. |

See [.env.example](.env.example) for the complete secret-free environment contract.

## Validation

```bash
npm run lint
npm test
npm run build
```

The regression suite validates the registry inventory, Tier-0 policy decisions, tenant isolation, safe mode, OmniRouter blocking, secret-bearing input rejection, compute and web-use boundaries, multi-agent routing, self-healing evidence, master wiring, final audit/lock posture, and governed bring-up.

To regenerate the runtime-derived complete-organism summary after a registry or governance change:

```bash
npx tsx scripts/generate-system-summary.ts
```

## Container and Cloud Portability

A single [Dockerfile](Dockerfile) builds the React UI and Node service, including Chromium for the explicitly controlled local-only screenshot capability. The same image contract is supported by Railway, GitHub Codespaces, Azure, and GCP. Railway-specific configuration is in [railway.toml](railway.toml); local multi-container configuration is in [compose.yaml](compose.yaml).

The health endpoints are designed for platform probes. A deployment is not certified merely because the image builds: target-platform secrets, durable database reachability, allowed origin configuration, and platform health checks must be verified in the deployment environment.

## Read-Only Governance and Posture Surfaces

Authenticated Mission Control uses tenant-scoped posture endpoints. The following are inspection surfaces, not activation commands:

| Endpoint | Evidence |
|---|---|
| `GET /api/autonomy/agents/posture` | Multi-agent registry, router, collaboration, oversight, arbitration, telemetry, and recovery boundary. |
| `GET /api/autonomy/compute` | Local topology and dormant remote/cluster adapter boundaries. |
| `GET /api/autonomy/infrastructure` | OmniRouter, Plugin Registry, runtime, device, compute, and recovery posture. |
| `GET /api/autonomy/web/posture` | Puppeteer-only web-use boundary, safety, drift, reality, and recovery evidence. |
| `GET /api/autonomy/self-healing` | Healthcheck, failure detection, repair, and evidence-preserving recovery posture. |
| `GET /api/autonomy/wiring` | Master wiring map and no-bypass validation evidence. |
| `GET /api/autonomy/audit` | Full-system audit with correction and escalation paths. |
| `GET /api/autonomy/governance-lock` | Constitution, doctrine, and Paragon runtime lock posture. |
| `GET /api/autonomy/bring-up` | Deterministic boot, readiness, and first synchronization evidence. |

## Security Note

Do not place credentials, tokens, private URLs, database strings, or provider keys in source files, documents, screenshots, logs, test fixtures, Git commits, or user-facing outputs. Configure them only through approved secret-management facilities.

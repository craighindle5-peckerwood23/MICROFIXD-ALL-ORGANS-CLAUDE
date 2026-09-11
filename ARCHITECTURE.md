# Microfixd Governed Autonomy Architecture

## Purpose

Microfixd is being converted from a demonstrator into a portable autonomous-runtime service. The runtime accepts high-level goals, builds a bounded execution plan, stores its operational experience, and executes permitted work without a human in the loop. **Paragon Dissector** is the mandatory gate before every action and after every candidate change. Human review is reserved for defined exception classes rather than routine work.

> Microfixd can autonomously propose and validate changes inside a disposable workspace. It does not silently alter production code, secrets, identity controls, infrastructure, dependencies, or governance policy. Those are explicit exception classes that require an operator decision.

| Concern | Production component | Design rule |
|---|---|---|
| Goal execution | `AutonomyRuntime` | A goal becomes a traceable run with a bounded step budget, deadlines, and idempotent status transitions. |
| Tier-0 final oversight authority | `ParagonDissector` | Paragon is the highest law inside Microfixd and sits above every present and future organ, including OmniRouter, Plugin Registry, Memory Engine, Task Engine, Workflow Engine, Cognition Engine, and autonomous modules. Every organ submits each proposed operation for a final binding decision. Paragon may allow, require Craig’s approval, or deny; no organ may execute, route, persist a privileged change, or override a decision without a corresponding Paragon record. |
| Self-repair and capability work | `SandboxWorkspace` | Candidate code is written and statically validated only in a disposable, path-confined workspace. It is never executed with host privileges or merged automatically into protected paths. |
| Introspection | `SystemInspector` | Runtime state derives from the process, environment, durable store, health probes, and recent run outcomes. It does not claim simulated hardware facts. |
| Working memory | `WorkingMemory` | Each run preserves active goal, plan, artifacts, policy findings, and state transitions. |
| Long-term memory | `MemoryStore` | Postgres is the production system of record for episodic, semantic, and procedural memory. A JSON store is available only for local development and single-instance demos. |
| Learning | `ExperienceLearner` | Outcome feedback is stored as scored experience and recalled as context for future planning. This is auditable experience learning, not unreviewed self-training. |
| Observability | `Telemetry` | Structured logs, run counters, latency histograms, health/readiness checks, and Prometheus-compatible metrics are emitted by the service. |
| Outbound integration | `OmniRouter` | This is the exclusive outbound HTTP client. It applies cache lookup, provider fallback, retry discipline, cost checks, and per-request audit logging. Direct `fetch`, SDK, or plugin network calls are prohibited outside this organ. |
| Plugin connections | `PluginRegistry` | The registry owns allowlisted plugin manifests, provider routes, cost/risk classifications, credential references, and execution history. A plugin may request a route but cannot open a network connection itself. |
| API recycling | `ApiRecyclingLayer` | Reuses cacheable responses and successful free-provider results before considering a paid provider, preserving provenance and expiration information. |
| Human-by-exception | `ApprovalQueue` | Paragon creates a pending approval only for a major change, a high-cost operation, or an uncertain/high-risk action. Craig is the designated approver. |

## Autonomy Lifecycle

A client submits a high-level goal. The runtime creates a durable run and working-memory record, recalls relevant experience, and produces a bounded plan. Before each planned action, Paragon Dissector evaluates the action against a deterministic policy. Low-risk introspection, memory, workflow-design, and sandbox-validation actions are allowed and are executed automatically. Restricted work becomes an approval request; forbidden work is denied. The result, policy evidence, artifacts, telemetry, and operator feedback become long-term memory.

## Integration Constitution

Paragon Dissector is **Tier-0**, the highest law inside Microfixd. All current and future organs operate under its constitutional boundary; no organ has an override path, including the organs that manage memory, tasks, workflows, cognition, plugins, integrations, or module activation. A call to OmniRouter, a Plugin Registry change, a memory write, a sandbox artifact, a workflow transition, an approval decision, and a health-affecting configuration change must first receive a binding Paragon decision. All outbound calls, including model-provider, plugin, and third-party service requests, are represented as `RouterRequest` objects and must pass through OmniRouter. OmniRouter validates that the named plugin is enabled in Plugin Registry, obtains the final Paragon evaluation of risk and estimated cost, consults the API Recycling Layer, selects the lowest-cost viable route, retries only idempotent or explicitly retry-safe requests, and emits a tamper-evident audit record. No other module may import a network client or receive provider credentials.

| Condition | Mandatory behavior |
|---|---|
| Cached response is fresh | Return the cached response and record a cache-hit audit event. |
| A free route is configured and healthy | Prefer the free route before a paid alternative. |
| Provider request fails transiently | Retry within the provider-specific bounded retry budget, then use an approved fallback route. |
| Cost or risk exceeds the configured threshold | Create an approval request for Craig before the request is sent. |
| Plugin is absent, disabled, or does not permit the operation | Deny the request and record the policy evidence. |
| Request is not routed through OmniRouter | Treat it as a doctrine violation; block it in code review, tests, and runtime dependency boundaries. |
| Any action lacks a final Paragon decision | Deny it before execution and emit a governance-violation audit event. |

| Risk tier | Typical operation | Default outcome |
|---|---|---|
| Low | Introspection, memory recall, workflow proposal, code validation in a confined workspace | Automatically execute. |
| Medium | Create or update a non-active sandbox capability artifact | Automatically execute only after static validation and full audit trail. |
| High | Activate a capability, modify application source, schema, dependencies, or runtime configuration | Create an operator approval request. |
| Critical | Change governance controls, secrets, deployment settings, external side effects, or production infrastructure | Deny by default; require an explicit operator-approved change process outside the autonomous executor. |

## Deployment Model

The service exposes one HTTP entrypoint and honors `PORT`. It can be launched directly with `npm start` or in the supplied Docker image. Production deployments must set `DATABASE_URL` for durable, multi-instance memory and `ADMIN_API_KEY` for privileged goal and approval actions. Railway, Codespaces, Azure, and GCP consume the same image and environment contract.

The deployment does not need access to Docker, the host filesystem, source-control credentials, or cloud-provider credentials to operate. Candidate capabilities are confined to the runtime sandbox path. This separation prevents a self-repair request from becoming unbounded host or infrastructure control.

## Human Operating Model

The operator supplies goals, reviews exception requests, and can disable execution through an environment-controlled emergency stop. The operator does not need to approve ordinary introspection, recall, planning, or sandbox validation. Every decision, including a denial, is observable through the run trace and approval endpoints.

## Non-Goals

This release does not implement autonomous production deployment, credential changes, arbitrary shell execution, dynamic loading of untrusted modules, direct outbound networking by plugins, or unsupervised modification of governance policy. Those controls are intentional prerequisites for a shippable governed system rather than missing automation.

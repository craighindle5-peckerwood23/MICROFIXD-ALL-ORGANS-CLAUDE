# Microfixd Production Requirements Baseline

This document records the **implementation scope** established in the conversation. It is not an exploratory proposal. Microfixd is being built as a portable synthetic system whose documented organs, phenotype model, integration rules, and governance constraints are executable system requirements.

## System Objective

Microfixd must autonomously pursue high-level goals within a bounded authority model. It must introspect its state, maintain working and long-term memory, record learning outcomes, design workflows and capability candidates, and perform self-repair **only inside a confined sandbox**. It is not permitted to silently mutate protected source, secrets, governance, production infrastructure, or external systems.

| Requirement | Implementation boundary |
|---|---|
| High autonomy with human-by-exception | Routine bounded work is automatic. Craig reviews high-risk, high-cost, protected, uncertain, architectural, and external-effect exceptions. |
| Tier-0 governance | Paragon Dissector is the final binding authority over every current and future organ. It has no override path. |
| Self-repair and evolution | Candidate artifacts are written and statically validated only in the sandbox. Activation, merge, deployment, and governance changes remain protected actions. |
| Memory and learning | Supabase is the durable system of record for runs, steps, memory, experience scores, policy decisions, approvals, phenotype snapshots, and system events. |
| Introspection and phenotype | The live phenotype is derived from current OS, CPU, memory, process, and cloud-provider signals rather than simulated hardware claims. |
| 150-organ roster | All fifteen ten-organ families are registered in the runtime with a native, composed, or adapter procedure. |
| Public viability | Browser roles have no direct access to protected tables; credentials remain server-side; secrets are redacted; direct provider access is prohibited. |

## Required Organs and Families

The complete **150-organ** roster is defined in `ORGANS.md` and registered by `src/autonomy/organ-registry.ts`. It contains the fifteen required families: Oversight & Governance; Cognition & Intelligence; Memory & Learning; Self-Modification & Evolution; Task & Workflow Execution; API & External Interface; Cloud Runtime & Infrastructure; Automotive & Machine Interface; Perception & Input; Output & Interaction; Puppeteer & Execution Control; Security & Threat Defense; Drift Protection & Stability; Hallucination Protection & Reality Anchoring; and Cinematic & Narrative Coherence.

An organ is not granted authority merely by appearing in the registry. **Native** organs have an internal runtime procedure. **Composed** organs execute through the Organ Kernel using native services. **Adapter** organs remain dormant until an approved Plugin Registry connection is present. Every invocation creates a Paragon Dissector decision record before a procedure response is returned.

## Integration Constitution

OmniRouter is the only allowed outbound HTTP implementation. Plugin Registry exclusively owns integration manifests, operation allowlists, route metadata, provider credential environment-variable references, risk classification, and route enablement. API Recycling Layer reuses cacheable results and orders free routes before paid routes. OmniRouter applies bounded retries only to retry-safe operations, records every cache hit, sent request, fallback, block, approval escalation, and failure, and consults Paragon before any provider call.

No plugin, organ, UI component, model adapter, or workflow component may directly call a provider API, hold raw provider credentials, or bypass OmniRouter. High-risk or high-cost requests escalate to Craig; critical actions are denied by default.

## Security and Truth Constraints

The build must keep all credential values out of source, UI, artifacts, output, and logs. The runtime screens task inputs for secret material, destructive commands, governance bypass attempts, unrestricted code execution, and oversized inputs. It redacts sensitive error output, bounds plans and retries, rejects plan and state drift, retains source and validation evidence, and prevents unsupported claims such as a production deployment, payment, credential rotation, or vehicle command execution without corresponding evidence.

## Persistence and Public Data Model

The Supabase migration in `supabase/migrations/20260820_microfixd_governed_system.sql` creates additive namespaced schema tables for governed runs, steps, memory, governance decisions, approvals, integration audits, the 150-organ registry, organ invocations, phenotype snapshots, and system events. RLS is enabled and no browser-facing policies are added. The application writes through its server-side database connection using `SUPABASE_DB_URL` or a portable `DATABASE_URL` fallback.

## Portable Deployment Contract

One Express HTTP entrypoint honors `PORT` and runs from a container without host-specific dependencies. Readiness requires durable memory when `REQUIRE_DURABLE_MEMORY=true`; liveness, startup, structured telemetry, and Prometheus-compatible metrics remain available for Railway, Codespaces, Azure, and GCP. The deployment must receive configuration only through environment variables, never source files.

## Explicitly Excluded or Protected

The system must not reveal or persist secret values, create unsafe direct external integrations, use unrestricted shell or browser automation, automatically deploy to production, mutate governance, alter protected dependencies, send payments, command vehicles, or claim unverified results. These constraints are production safety requirements, not missing features.

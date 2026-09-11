# Microfixd Level-6 Governed Operations Architecture

## Architecture Principle

Microfixd is extended as a **governed operations platform**, not an autonomous production-change engine. Every role, organ, tenant, workflow, external connection, compute route, and operator control is recorded and preflighted by **Paragon Dissector**, the Tier-0 final authority. The platform may autonomously inspect, plan, validate confined candidates, route approved low-risk work, and create audit evidence. It cannot silently change active source, production infrastructure, secrets, tenant boundaries, provider connections, or external state.

> **Authority rule:** Global Tier-0 Paragon precedes tenant policy, agent role policy, compute routing, web routing, sandbox evolution, and mission-control requests. A tenant cannot relax the global constitution.

## The Eight Layers

| Layer | Runtime responsibility | Primary executable components | Safe activation rule |
|---:|---|---|---|
| 0 | Constitutional | Constitution, doctrine, identity anchor, autonomy regulator, safe mode, Paragon | Boots before any agent, organ invocation, workflow, plugin, or tenant request. |
| 1 | Organ architecture | Registry, boot sequence, wiring map, lifecycle telemetry, repair engine, kernel | Every organ is registered, versioned, preflighted, observable, and auditable. |
| 2 | Cognitive | Cognition, planning, inference, logic, understanding, decision, six agent roles | Agent work is bounded, tenant-scoped, and evaluated by Paragon before tool use. |
| 3 | Memory | Working, long-term, experience, compression, learning, audit memory | Durable records are tenant-scoped; global audit is privileged and append-only. |
| 4 | Execution | Task, workflow, queue, retry, action governor, execution stabilizer, Puppeteer | A run has a bounded step budget and no direct provider or host-execution bypass. |
| 5 | Self-evolution | Sandbox, builder, mutation, refactor, repair, GitHub change request, rollback | Candidate artifacts only; tests and Paragon review precede any protected PR/deploy action. |
| 6 | Safety | Security, permissions, tenant isolation, drift, reality, output qualification, fallback | Unsafe conditions halt to safe mode or escalation without production alteration. |
| 7 | Infrastructure | Runtime, Cloud, GPU/eGPU capability discovery, compute routing, web/provider boundary, metrics | Local discovery is read-only; remote compute and web routes require an approved plugin manifest. |

## Organ Expansion

The registry target is **200 organs across 21 families**. The original 150 remain intact; the following fifty organs add explicit Layer 1–7 coverage.

| New family | Organs | Mode and boundary |
|---|---:|---|
| Organ Lifecycle & Repair | 8 | Boot/wiring/repair/failure/health procedures; native inspection and composed repair proposals only. |
| Multi-Agent Cognitive System | 11 | Durable role registry and deterministic role routing; agents create bounded artifacts, not ungoverned actions. |
| Compute & Multi-Runtime | 8 | Local hardware discovery; remote GPU/eGPU/cluster providers remain OmniRouter adapters. |
| Governed Web & Source Control | 7 | Browser/web/GitHub/CI/deploy procedures are Plugin Registry adapters under Paragon. |
| Multi-Tenant Enterprise | 8 | Tenant registry, constitution/doctrine, isolation, plugin/workflow scope, audit, switching. |
| Mission Control & Operator Interface | 8 | Holographic control state, visualizers, approval, safe mode, telemetry, log, snapshot, and command procedures. |

## Multi-Agent Control Plane

| Agent | Mandate | Permitted output |
|---|---|---|
| Planner | Creates a bounded plan from a goal and relevant tenant memory. | Plan proposal. |
| Critic/Safety | Tests plans against constitution, policy, drift, and safety constraints. | Allow, revise, escalation, or denial recommendation. |
| Builder | Creates a sandbox-only capability artifact. | Candidate module and validation record. |
| Repair | Converts a detected failure into a non-destructive repair candidate. | Repair proposal and fallback record. |
| Reflection | Produces evidence-grounded run and agent assessment. | Metacognitive report. |
| Meta-Agent | Coordinates role handoff, arbitration input, and system-level evidence. | Bounded orchestration record. |

Agent roles are logical work partitions, not claims of independently conscious entities. Each handoff is recorded with tenant, run, role, evidence, and final Paragon outcome.

## Tenant Control Plane

A tenant owns its name, tenant-local doctrine, plugin allowlist, workflows, agents, memory records, and non-global audit views. A tenant request must contain a valid tenant identifier. The global default tenant is used only for backward-compatible internal operations. The Tenant Isolation Guard rejects cross-tenant reads, writes, approval decisions, agent work, and plugin routing before execution.

## Compute and Web Boundaries

| Capability | Local capability | Protected extension |
|---|---|---|
| GPU/eGPU | Environment and platform capability scan. | Approved provider adapter with cost policy and quota. |
| Distributed/cluster compute | Plan, queue, and job-spec validation. | Approved cluster adapter, authenticated route, and Paragon decision. |
| Browser/web use | Local Microfixd console capture only. | Browser Plugin Registry route through OmniRouter, with domain allowlist and audit. |
| GitHub evolution | Sandbox candidate, test result, change request record. | GitHub adapter creates PR only after Paragon escalation/approval; merges and deployment remain separately protected. |

## Mission-Control UI

The human operator interface is a browser-native holographic representation: an animated **humanoid head silhouette**, orbital layer indicators, live system pulse, health, agents, organs, tenant context, approvals, safe-mode state, telemetry, and governed action controls. It is a visual control plane, not a claim of physical embodiment. Every command it issues uses the same authenticated route and Tier-0 gate as programmatic callers.

## End-to-End Flow

```text
Operator or API request
  → identity and tenant isolation guard
  → Layer-0 constitution + Paragon preflight
  → agent/router or organ kernel
  → bounded workflow / sandbox / local discovery / approved adapter request
  → safety, drift, reality, and output qualification
  → Supabase tenant-scoped durable records + telemetry
  → mission-control view, approval queue, or safely qualified response
```

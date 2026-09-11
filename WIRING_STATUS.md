# Microfixd Organ Wiring Status

## Verified Runtime Result

The current runtime exposes **150 registered organs across 15 families**. The registry integrity check is enforced at startup, the active service reported all 150 through `GET /api/autonomy/organs`, and the live phenotype/introspection endpoint, governed organ endpoint, successful sandbox run, high-risk escalation, and protected-payment denial were exercised against the current production build.

| Wiring class | Count | Meaning |
|---|---:|---|
| **Native** | 66 | The organ has a direct bounded runtime procedure in the server, store, security, integrity, phenotype, router, sandbox, telemetry, or ingress implementation. |
| **Composed** | 63 | The organ has an executable Organ Kernel procedure that composes native procedures under a saved Paragon decision; it is not an ungoverned placeholder. |
| **Adapter** | 21 | The organ is fully registered and governed but remains intentionally dormant until an allowlisted Plugin Registry manifest and OmniRouter route are configured. It cannot make direct external calls. |
| **Total** | **150** | Every organ is Tier-0-governed by Paragon Dissector. |

> **Accurate answer:** The architecture and governance wiring are end-to-end for all 150 organs. The 66 native and 63 composed organs are connected through the Organ Kernel, Paragon Dissector, runtime, memory, telemetry, and Supabase persistence paths. The 21 external-adapter organs are intentionally not connected to real third parties yet, because doing so without an approved plugin, credential reference, provider route, cost policy, and Paragon decision would violate the integration constitution.

## System-Wide Execution Pipeline

```text
User goal or organ procedure
  → API Shield / Permission / Identity Guard
  → Security Organs input screening
  → Task Engine or Organ Kernel
  → Paragon Dissector (Tier-0 final decision)
  → allow | Craig approval queue | deny
  → native/composed procedure OR OmniRouter adapter boundary
  → Stability / Drift / Reality controls
  → Supabase audit, memory, phenotype, decision, and event records
  → Response / UI / Output Auditor
```

No registered organ has a direct provider-network bypass. Any adapter that requires a real external system follows this enforced path:

```text
Adapter organ → Plugin Registry → OmniRouter → API Recycling Layer
              → Paragon cost/risk decision → provider route
              → integration audit → Supabase
```

## Family-by-Family Wiring

| # | Family | Native | Composed | Adapter | End-to-end connection |
|---:|---|---:|---:|---:|---|
| 1 | Oversight & Governance | 5 | 5 | 0 | All route to Paragon; constitution, policy, risk, escalation, safety, and autonomy checks are active. |
| 2 | Cognition & Intelligence | 2 | 8 | 0 | Goal classification and planning are native; reflection, inference, logic, mapping, and decision procedures compose through the kernel. |
| 3 | Memory & Learning | 6 | 4 | 0 | Working memory, durable long-term memory, recall, experience, learning, compression, graph, skill, and audit paths persist through the store. |
| 4 | Self-Modification & Evolution | 2 | 7 | 1 | Candidate-only sandbox evolution is wired; deployment is a protected adapter and cannot activate autonomously. |
| 5 | Task & Workflow Execution | 7 | 3 | 0 | Durable runs, steps, retry bounds, execution, orchestration, progress, completion, scheduling, queue, and pipeline procedures are wired. |
| 6 | API & External Interface | 3 | 0 | 7 | OmniRouter, Plugin Registry, and recycling are active; external connectors are dormant until registered. |
| 7 | Cloud Runtime & Infrastructure | 9 | 1 | 0 | Port injection, health/readiness, liveness, secrets boundary, container, resource, auditor, scaling policy, and runtime posture are wired. |
| 8 | Automotive & Machine Interface | 0 | 1 | 9 | Diagnostics normalization is governed; OBD2/ECM/TCM/BCM/ECU/CAN/VIN/freeze-frame/sensor connections need approved adapters. |
| 9 | Perception & Input | 3 | 4 | 3 | Text, intent, context, signal, pattern, classification, perception audit, vision/audio/translation boundaries are wired. |
| 10 | Output & Interaction | 6 | 3 | 1 | Responses, UI, actions, outputs, formatting, interaction, command, behavior, output audit, and delivery boundary are wired. |
| 11 | Puppeteer & Execution Control | 5 | 5 | 0 | The bounded action controller, governor, stabilizer, workflow control, command interpretation, audit, routing, motor, rollback, and explicitly enabled local-console screenshot procedures are wired. |
| 12 | Security & Threat Defense | 7 | 3 | 0 | Input threat detection, API shielding, permissions, boundaries, identity, plugin security, intrusion/encryption procedures, and audit are wired. |
| 13 | Drift Protection & Stability | 4 | 6 | 0 | Baseline identity, execution bounds, consistency, memory/reasoning/behavior/organ drift, stability, and auditing are wired. |
| 14 | Hallucination Protection & Reality Anchoring | 6 | 4 | 0 | Evidence qualification, verification, source integrity, claim suppression, reasoning guard, cross-check, truth, sentinel, and reality audit are wired. |
| 15 | Cinematic & Narrative Coherence | 1 | 9 | 0 | Persona, accurate chronology, tone, style, dialogue, interaction style, continuity, scene, and coherence-audit procedures are wired. |

## Full Organ Roster

The complete names, stable IDs, tiers, modes, guided endpoint paths, and responsibilities are in `ORGANS.md` and exposed by `GET /api/autonomy/organs`. The fifteen families are:

1. Oversight & Governance: Paragon Dissector; Constitution Engine; Doctrine Engine; Risk Governor; Ethics Organ; Drift Monitor; Escalation Organ; Policy Interpreter; Safety Sentinel; Autonomy Regulator.
2. Cognition & Intelligence: Cognition Engine; Reflection Organ; Planning Organ; Inference Organ; Logic Organ; Understanding Organ; Interpretation Organ; Reasoning Matrix; Decision Organ; Cognitive Map.
3. Memory & Learning: Memory Engine; Long-Term Memory Organ; Working Memory Organ; Memory Compression Organ; Experience Recorder; Knowledge Graph Organ; Recall Organ; Learning Organ; Skill Acquisition Organ; Memory Auditor.
4. Self-Modification & Evolution: Self-Modifying Engine; Sandbox Organ; Mutation Organ; Evolution Organ; Refactor Organ; Code Generation Organ; Module Builder; Deployment Organ; Rollback Organ; Self-Audit Organ.
5. Task & Workflow Execution: Task Engine; Workflow Engine; Scheduler Organ; Retry Organ; Queue Organ; Execution Organ; Pipeline Organ; Orchestration Organ; Progress Organ; Completion Organ.
6. API & External Interface: OmniRouter Organ; Plugin Registry Organ; API Recycling Layer; Webhook Organ; Email Organ; SMS Organ; Phone Organ; Calendar Organ; Payments Organ; Social Graph Organ.
7. Cloud Runtime & Infrastructure: Cloud Runtime Organ; Port Injection Organ; Secrets Organ; Healthcheck Organ; Startup Probe Organ; Liveness Probe Organ; Scaling Organ; Resource Organ; Container Organ; Runtime Auditor.
8. Automotive & Machine Interface: OBD2 Organ; ECM Organ; TCM Organ; BCM Organ; ECU Organ; CANBus Organ; VIN Organ; FreezeFrame Organ; Sensor Organ; Diagnostics Organ.
9. Perception & Input: Vision Organ; Audio Organ; Text Organ; Intent Organ; Context Organ; Signal Organ; Pattern Organ; Classifier Organ; Translator Organ; Perception Auditor.
10. Output & Interaction: Response Organ; UI Organ; Action Organ; Command Organ; Execution Output Organ; Formatting Organ; Delivery Organ; Interaction Organ; Behavior Organ; Output Auditor.
11. Puppeteer & Execution Control: Puppeteer Organ; Action Governor; Execution Stabilizer; Behavior Router; Intent-to-Action Organ; Motor Logic Organ; Workflow Puppeteer; Command Interpreter; Action Auditor; Action Rollback Organ.
12. Security & Threat Defense: Security Organ; Threat Detection Organ; Intrusion Organ; Permission Organ; Boundary Organ; Encryption Organ; Identity Guard; API Shield Organ; Plugin Security Organ; Security Auditor.
13. Drift Protection & Stability: Drift Protection Organ; Stability Organ; Consistency Organ; Baseline Intelligence Organ; Identity Anchor; Memory-Drift Monitor; Reasoning-Drift Monitor; Behavior-Drift Monitor; Organ-Drift Monitor; Drift Auditor.
14. Hallucination Protection & Reality Anchoring: Hallucination Filter; Reality Anchor Organ; Verification Organ; Cross-Check Organ; Source Integrity Organ; Truth-Model Organ; Error-Suppression Organ; Reasoning-Guard Organ; Hallucination Sentinel; Reality Auditor.
15. Cinematic & Narrative Coherence: Cinematic Organ; Narrative Organ; Tone Organ; Style Organ; Persona Organ; Dialogue Organ; Interaction Style Organ; Continuity Organ; Scene Organ; Cinematic Auditor.

## Live Smoke-Test Evidence

| Check | Observed result |
|---|---|
| `GET /healthz` | `ok` |
| `GET /readyz` in intentionally local JSON mode | `degraded`, as designed; production requires Supabase durable memory. |
| Public organ registry | 150 total, 66 native, 63 composed, 21 adapter, 15 families, Tier-0 Paragon. |
| Privileged introspection | Returned a live phenotype profile and the 150-organ summary. |
| Local-console screenshot | Captured and visually reviewed a valid 1440 × 1348 PNG through the Tier-0-governed Puppeteer procedure; all non-local navigation was blocked. |
| Security Organ procedure | Allowed only after a recorded Tier-0 Paragon decision. |
| Payments adapter preparation | Denied with HTTP 403 by Tier-0 policy. |
| Sandbox self-repair goal | Succeeded through its bounded plan. |
| Production external API/deploy goal | Halted in `awaiting_approval` for Craig. |

## Remaining Activation Work

No governance or wiring change is needed to add a real provider. To activate any adapter, register a Plugin Registry manifest, place only the provider credential in deployment secrets, define an allowlisted OmniRouter route, set its risk/cost parameters, and test it through a low-risk non-production operation. Paragon will continue to decide every invocation. Local-console screenshots are not an external provider integration: they require both Chromium and `MICROFIXD_ENABLE_LOCAL_SCREENSHOTS=true`, capture only the service’s own console, and block all non-local navigation.

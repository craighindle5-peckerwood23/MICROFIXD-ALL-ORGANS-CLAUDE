# Microfixd Complete-Organism Summary

> **Runtime-derived inventory.** This document is generated from the authoritative 200-organ registry and source-level governance contracts. It describes implemented controls and declared adapter boundaries; it does not claim unconfigured third-party integrations, physical source-code immutability, or autonomous production activation.

Microfixd currently registers **200 organs**, **21 families**, and **8 foundational layers**. Every registered organ is tenant-isolated, is subject to a Paragon Dissector oversight hook, and must use the Organ Kernel for governed procedures. The primary system authority is the [Paragon Dissector](src/autonomy/governance.ts); the complete registry is defined in [organ-registry.ts](src/autonomy/organ-registry.ts).

## Guided System Map

| Surface | Canonical implementation | Evidence / inspection surface |
|---|---|---|
| Constitution and doctrine | [governance.ts](src/autonomy/governance.ts) | `GET /api/autonomy/governance-lock` |
| Organ registry and lifecycle | [organ-registry.ts](src/autonomy/organ-registry.ts), [organ-lifecycle.ts](src/autonomy/organ-lifecycle.ts) | `GET /api/autonomy/wiring` |
| Cognition and reflection | [cognition.ts](src/autonomy/cognition.ts), [auxiliary-organs.ts](src/autonomy/auxiliary-organs.ts) | Run metacognition evidence |
| Tenant memory | [memory.ts](src/autonomy/memory.ts) | `GET /api/autonomy/memory/posture` |
| Bounded execution and web use | [execution.ts](src/autonomy/execution.ts) | `GET /api/autonomy/web/posture` |
| Sandbox-only evolution | [evolution.ts](src/autonomy/evolution.ts) | Protected change-control routes |
| Infrastructure and compute | [infrastructure.ts](src/autonomy/infrastructure.ts), [level6.ts](src/autonomy/level6.ts) | `GET /api/autonomy/infrastructure`, `GET /api/autonomy/compute` |
| Multi-agent workforce | [level6.ts](src/autonomy/level6.ts) | `GET /api/autonomy/agents/posture` |
| Self-healing evidence | [self-healing.ts](src/autonomy/self-healing.ts) | `GET /api/autonomy/self-healing` |
| Master wiring | [system-wiring.ts](src/autonomy/system-wiring.ts) | `GET /api/autonomy/wiring` |
| Final audit and lock posture | [final-audit.ts](src/autonomy/final-audit.ts) | `GET /api/autonomy/audit`, `GET /api/autonomy/governance-lock` |
| Governed bring-up | [bring-up.ts](src/autonomy/bring-up.ts) | `GET /api/autonomy/bring-up` |
| Holographic Mission Control | [OperationsConsole.tsx](src/OperationsConsole.tsx) | Protected tenant-scoped UI |

## Constitutional and Doctrine Hooks

The frozen constitution is **v2.0.0** and has **10 invariants**. The frozen doctrine is **v2.0.0** and has **4 invariants**. Both contracts are attested by the governance-lock evidence record; the lock records runtime posture and does not replace protected source, database, deployment, or adapter change control.

| Contract | Binding rule |
|---|---|
| Constitution | Paragon Dissector is the final binding oversight authority for all Microfixd organs. |
| Doctrine | Doctrine guides presentation, narrative, escalation style, and tenant-local expression but cannot relax constitutional invariants, safety controls, Paragon authority, or Craig approval requirements. |
| Paragon | Tier-0 final decision authority. No bypass path is represented in the registry, wiring map, routes, or execution procedure. |
| OmniRouter | Exclusive outbound path; Plugin Registry and Paragon govern every provider route. |
| Tenant isolation | Runs, memory, agents, approvals, posture records, and workflow evidence carry tenant context. |
| Evolution | Candidates are sandbox-only; activation, merge, deploy, rollback, and protected changes require separate Paragon/Craig/adapter evidence. |

## Foundational Layers

| Layer | Purpose | Organs | Families represented |
|---:|---|---:|---:|
| 0 | Identity, constitution, doctrine, and Tier-0 governance. | 10 | 1 |
| 1 | Organ lifecycle, registry integrity, declarative wiring, and health evidence. | 8 | 1 |
| 2 | Cognitive planning, assessment, mapping, and drift evidence. | 31 | 3 |
| 3 | Tenant-isolated memory routing, recall, compression proposals, and memory posture. | 10 | 1 |
| 4 | Bounded workflow and task execution, Puppeteer-only web authority, and execution evidence. | 40 | 4 |
| 5 | Sandbox-only evolution candidates, GitHub/CI-CD boundaries, change control, and rollback evidence. | 17 | 2 |
| 6 | Safety, security, drift, reality anchoring, fallback, and approval boundaries. | 48 | 5 |
| 7 | OmniRouter-exclusive infrastructure, plugin registry, runtime, compute, cloud portability, and observability. | 36 | 4 |

## Enterprise and Operational Overlays

| Overlay | Implemented controlled surface | Primary evidence |
|---|---|---|
| Multi-tenant enterprise | Tenant profile, isolated approvals, memory, agent registry, compute, safety, evolution, and posture records. | Tenant Control Plane and protected tenant APIs |
| Governed compute | Read-only local topology with dormant remote, distributed, GPU, and cluster adapter paths. | Compute profile records |
| Governed web use | Puppeteer-only browser authority, reality anchoring, and security gate before OmniRouter routing. | Web-use posture records |
| Multi-agent workforce | Six versioned, tenant-isolated roles routed through Agent Router, collaboration, oversight, and arbitration evidence. | Agent and agent-execution records |
| Self-healing | Failure detection, health assessment, evidence-preserving fallback, and sandbox-only repair proposals. | Health-assessment and repair-proposal records |
| Master wiring | Declarative organ edges and cross-cutting no-bypass topology validation. | Organ-wiring records |
| Final audit and lock-in | Evidence-based certification and frozen runtime-contract attestation. | Audit-assessment and governance-lock records |
| Governed bring-up | Strict first-boot sequence, readiness, and first synchronization evidence. | Organ-boot records |

## Multi-Agent Workforce

| Initialization order | Agent | Role boundary |
|---:|---|---|
| 1 | Meta-Agent | Tenant-scoped evidence, bounded responsibility, no direct provider, web, production, cross-tenant, merge, deploy, or Paragon-bypass authority. |
| 2 | Critic / Safety Agent | Tenant-scoped evidence, bounded responsibility, no direct provider, web, production, cross-tenant, merge, deploy, or Paragon-bypass authority. |
| 3 | Reflection Agent | Tenant-scoped evidence, bounded responsibility, no direct provider, web, production, cross-tenant, merge, deploy, or Paragon-bypass authority. |
| 4 | Planner Agent | Tenant-scoped evidence, bounded responsibility, no direct provider, web, production, cross-tenant, merge, deploy, or Paragon-bypass authority. |
| 5 | Builder Agent | Tenant-scoped evidence, bounded responsibility, no direct provider, web, production, cross-tenant, merge, deploy, or Paragon-bypass authority. |
| 6 | Repair Agent | Tenant-scoped evidence, bounded responsibility, no direct provider, web, production, cross-tenant, merge, deploy, or Paragon-bypass authority. |

## Full 200-Organ Inventory

> Each record below is drawn directly from `ORGAN_REGISTRY`. **Mode** identifies implementation shape, not authority. Every item remains subject to Tier-0 Paragon oversight, Organ Kernel procedure boundaries, tenant isolation, and recorded telemetry.

### Layer 0: Identity, constitution, doctrine, and Tier-0 governance.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 1. Oversight & Governance | Autonomy Regulator | `autonomy-regulator` | tier-1 / composed | nominal (100) | 5 |
| 1. Oversight & Governance | Constitution Engine | `constitution-engine` | tier-1 / native | nominal (100) | 0 |
| 1. Oversight & Governance | Doctrine Engine | `doctrine-engine` | tier-1 / composed | nominal (100) | 5 |
| 1. Oversight & Governance | Drift Monitor | `drift-monitor` | tier-1 / composed | nominal (100) | 5 |
| 1. Oversight & Governance | Escalation Organ | `escalation-organ` | tier-1 / native | nominal (100) | 5 |
| 1. Oversight & Governance | Ethics Organ | `ethics-organ` | tier-1 / composed | nominal (100) | 5 |
| 1. Oversight & Governance | Paragon Dissector | `paragon-dissector` | tier-0 / native | nominal (100) | 5 |
| 1. Oversight & Governance | Policy Interpreter | `policy-interpreter` | tier-1 / native | nominal (100) | 5 |
| 1. Oversight & Governance | Risk Governor | `risk-governor` | tier-1 / native | nominal (100) | 5 |
| 1. Oversight & Governance | Safety Sentinel | `safety-sentinel` | tier-1 / composed | nominal (100) | 5 |

### Layer 1: Organ lifecycle, registry integrity, declarative wiring, and health evidence.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 16. Organ Lifecycle & Repair | Failure Detection Organ | `failure-detection-organ` | tier-1 / native | nominal (100) | 5 |
| 16. Organ Lifecycle & Repair | Health Trigger Organ | `health-trigger-organ` | tier-1 / native | nominal (100) | 5 |
| 16. Organ Lifecycle & Repair | Organ Boot Layer | `organ-boot-layer` | tier-1 / native | nominal (100) | 5 |
| 16. Organ Lifecycle & Repair | Organ Repair Engine | `organ-repair-engine` | tier-1 / composed | nominal (100) | 5 |
| 16. Organ Lifecycle & Repair | Organ Telemetry Organ | `organ-telemetry-organ` | tier-1 / native | nominal (100) | 5 |
| 16. Organ Lifecycle & Repair | Organ Wiring Layer | `organ-wiring-layer` | tier-1 / native | nominal (100) | 5 |
| 16. Organ Lifecycle & Repair | Repair Validator | `repair-validator` | tier-1 / composed | nominal (100) | 5 |
| 16. Organ Lifecycle & Repair | Runtime Repair Organ | `runtime-repair-organ` | tier-1 / composed | nominal (100) | 5 |

### Layer 2: Cognitive planning, assessment, mapping, and drift evidence.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 2. Cognition & Intelligence | Cognition Engine | `cognition-engine` | tier-2 / native | nominal (100) | 5 |
| 2. Cognition & Intelligence | Cognitive Map | `cognitive-map` | tier-2 / composed | nominal (100) | 5 |
| 2. Cognition & Intelligence | Decision Organ | `decision-organ` | tier-2 / composed | nominal (100) | 5 |
| 2. Cognition & Intelligence | Inference Organ | `inference-organ` | tier-2 / composed | nominal (100) | 5 |
| 2. Cognition & Intelligence | Interpretation Organ | `interpretation-organ` | tier-2 / composed | nominal (100) | 5 |
| 2. Cognition & Intelligence | Logic Organ | `logic-organ` | tier-2 / composed | nominal (100) | 5 |
| 2. Cognition & Intelligence | Planning Organ | `planning-organ` | tier-2 / native | nominal (100) | 5 |
| 2. Cognition & Intelligence | Reasoning Matrix | `reasoning-matrix` | tier-2 / composed | nominal (100) | 5 |
| 2. Cognition & Intelligence | Reflection Organ | `reflection-organ` | tier-2 / composed | nominal (100) | 5 |
| 2. Cognition & Intelligence | Understanding Organ | `understanding-organ` | tier-2 / composed | nominal (100) | 5 |
| 9. Perception & Input | Audio Organ | `audio-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 9. Perception & Input | Classifier Organ | `classifier-organ` | tier-2 / composed | nominal (100) | 5 |
| 9. Perception & Input | Context Organ | `context-organ` | tier-2 / native | nominal (100) | 5 |
| 9. Perception & Input | Intent Organ | `intent-organ` | tier-2 / native | nominal (100) | 5 |
| 9. Perception & Input | Pattern Organ | `pattern-organ` | tier-2 / composed | nominal (100) | 5 |
| 9. Perception & Input | Perception Auditor | `perception-auditor` | tier-2 / composed | nominal (100) | 5 |
| 9. Perception & Input | Signal Organ | `signal-organ` | tier-2 / composed | nominal (100) | 5 |
| 9. Perception & Input | Text Organ | `text-organ` | tier-2 / native | nominal (100) | 5 |
| 9. Perception & Input | Translator Organ | `translator-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 9. Perception & Input | Vision Organ | `vision-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 17. Multi-Agent Cognitive System | Agent Arbitration Organ | `agent-arbitration-organ` | tier-1 / native | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Agent Collaboration Organ | `agent-collaboration-organ` | tier-1 / native | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Agent Oversight Organ | `agent-oversight-organ` | tier-1 / native | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Agent Registry | `agent-registry` | tier-1 / native | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Agent Router | `agent-router` | tier-1 / native | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Builder Agent | `builder-agent` | tier-1 / composed | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Critic Safety Agent | `critic-safety-agent` | tier-1 / composed | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Meta-Agent | `meta-agent` | tier-1 / composed | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Planner Agent | `planner-agent` | tier-1 / composed | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Reflection Agent | `reflection-agent` | tier-1 / composed | nominal (100) | 5 |
| 17. Multi-Agent Cognitive System | Repair Agent | `repair-agent` | tier-1 / composed | nominal (100) | 5 |

### Layer 3: Tenant-isolated memory routing, recall, compression proposals, and memory posture.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 3. Memory & Learning | Experience Recorder | `experience-recorder` | tier-2 / native | nominal (100) | 5 |
| 3. Memory & Learning | Knowledge Graph Organ | `knowledge-graph-organ` | tier-2 / composed | nominal (100) | 5 |
| 3. Memory & Learning | Learning Organ | `learning-organ` | tier-2 / native | nominal (100) | 5 |
| 3. Memory & Learning | Long-Term Memory Organ | `long-term-memory-organ` | tier-2 / native | nominal (100) | 5 |
| 3. Memory & Learning | Memory Auditor | `memory-auditor` | tier-2 / composed | nominal (100) | 5 |
| 3. Memory & Learning | Memory Compression Organ | `memory-compression-organ` | tier-2 / composed | nominal (100) | 5 |
| 3. Memory & Learning | Memory Engine | `memory-engine` | tier-2 / native | nominal (100) | 5 |
| 3. Memory & Learning | Recall Organ | `recall-organ` | tier-2 / native | nominal (100) | 5 |
| 3. Memory & Learning | Skill Acquisition Organ | `skill-acquisition-organ` | tier-2 / composed | nominal (100) | 5 |
| 3. Memory & Learning | Working Memory Organ | `working-memory-organ` | tier-2 / native | nominal (100) | 5 |

### Layer 4: Bounded workflow and task execution, Puppeteer-only web authority, and execution evidence.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 5. Task & Workflow Execution | Completion Organ | `completion-organ` | tier-2 / native | nominal (100) | 5 |
| 5. Task & Workflow Execution | Execution Organ | `execution-organ` | tier-2 / native | nominal (100) | 5 |
| 5. Task & Workflow Execution | Orchestration Organ | `orchestration-organ` | tier-2 / native | nominal (100) | 5 |
| 5. Task & Workflow Execution | Pipeline Organ | `pipeline-organ` | tier-2 / composed | nominal (100) | 5 |
| 5. Task & Workflow Execution | Progress Organ | `progress-organ` | tier-2 / native | nominal (100) | 5 |
| 5. Task & Workflow Execution | Queue Organ | `queue-organ` | tier-2 / composed | nominal (100) | 5 |
| 5. Task & Workflow Execution | Retry Organ | `retry-organ` | tier-2 / native | nominal (100) | 5 |
| 5. Task & Workflow Execution | Scheduler Organ | `scheduler-organ` | tier-2 / composed | nominal (100) | 5 |
| 5. Task & Workflow Execution | Task Engine | `task-engine` | tier-2 / native | nominal (100) | 5 |
| 5. Task & Workflow Execution | Workflow Engine | `workflow-engine` | tier-2 / native | nominal (100) | 5 |
| 8. Automotive & Machine Interface | BCM Organ | `bcm-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | CANBus Organ | `canbus-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | Diagnostics Organ | `diagnostics-organ` | tier-2 / composed | nominal (100) | 5 |
| 8. Automotive & Machine Interface | ECM Organ | `ecm-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | ECU Organ | `ecu-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | FreezeFrame Organ | `freezeframe-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | OBD2 Organ | `obd2-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | Sensor Organ | `sensor-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | TCM Organ | `tcm-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 8. Automotive & Machine Interface | VIN Organ | `vin-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 10. Output & Interaction | Action Organ | `action-organ` | tier-2 / native | nominal (100) | 5 |
| 10. Output & Interaction | Behavior Organ | `behavior-organ` | tier-2 / composed | nominal (100) | 5 |
| 10. Output & Interaction | Command Organ | `command-organ` | tier-2 / composed | nominal (100) | 5 |
| 10. Output & Interaction | Delivery Organ | `delivery-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 10. Output & Interaction | Execution Output Organ | `execution-output-organ` | tier-2 / native | nominal (100) | 5 |
| 10. Output & Interaction | Formatting Organ | `formatting-organ` | tier-2 / native | nominal (100) | 5 |
| 10. Output & Interaction | Interaction Organ | `interaction-organ` | tier-2 / native | nominal (100) | 5 |
| 10. Output & Interaction | Output Auditor | `output-auditor` | tier-2 / composed | nominal (100) | 5 |
| 10. Output & Interaction | Response Organ | `response-organ` | tier-2 / native | nominal (100) | 5 |
| 10. Output & Interaction | UI Organ | `ui-organ` | tier-2 / native | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Action Auditor | `action-auditor` | tier-1 / native | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Action Governor | `action-governor` | tier-1 / native | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Action Rollback Organ | `action-rollback-organ` | tier-1 / composed | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Behavior Router | `behavior-router` | tier-1 / composed | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Command Interpreter | `command-interpreter` | tier-1 / native | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Execution Stabilizer | `execution-stabilizer` | tier-1 / native | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Intent-to-Action Organ | `intent-to-action-organ` | tier-1 / composed | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Motor Logic Organ | `motor-logic-organ` | tier-1 / composed | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Puppeteer Organ | `puppeteer-organ` | tier-1 / composed | nominal (100) | 5 |
| 11. Puppeteer & Execution Control | Workflow Puppeteer | `workflow-puppeteer` | tier-1 / native | nominal (100) | 5 |

### Layer 5: Sandbox-only evolution candidates, GitHub/CI-CD boundaries, change control, and rollback evidence.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 4. Self-Modification & Evolution | Code Generation Organ | `code-generation-organ` | tier-2 / composed | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Deployment Organ | `deployment-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 4. Self-Modification & Evolution | Evolution Organ | `evolution-organ` | tier-2 / composed | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Module Builder | `module-builder` | tier-2 / composed | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Mutation Organ | `mutation-organ` | tier-2 / composed | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Refactor Organ | `refactor-organ` | tier-2 / composed | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Rollback Organ | `rollback-organ` | tier-2 / composed | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Sandbox Organ | `sandbox-organ` | tier-2 / native | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Self-Audit Organ | `self-audit-organ` | tier-2 / composed | nominal (100) | 5 |
| 4. Self-Modification & Evolution | Self-Modifying Engine | `self-modifying-engine` | tier-2 / native | nominal (100) | 5 |
| 19. Governed Web & Source Control | Browser Organ | `browser-organ` | tier-1 / adapter | adapter-dormant (90) | 5 |
| 19. Governed Web & Source Control | Change Request Organ | `change-request-organ` | tier-1 / composed | nominal (100) | 5 |
| 19. Governed Web & Source Control | CI CD Gate Organ | `ci-cd-gate-organ` | tier-1 / adapter | adapter-dormant (90) | 5 |
| 19. Governed Web & Source Control | Domain Allowlist Organ | `domain-allowlist-organ` | tier-1 / native | nominal (100) | 5 |
| 19. Governed Web & Source Control | GitHub Connector Organ | `github-connector-organ` | tier-1 / adapter | adapter-dormant (90) | 5 |
| 19. Governed Web & Source Control | Web Automation Organ | `web-automation-organ` | tier-1 / adapter | adapter-dormant (90) | 5 |
| 19. Governed Web & Source Control | Web Interaction Organ | `web-interaction-organ` | tier-1 / adapter | adapter-dormant (90) | 5 |

### Layer 6: Safety, security, drift, reality anchoring, fallback, and approval boundaries.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 12. Security & Threat Defense | API Shield Organ | `api-shield-organ` | tier-1 / native | nominal (100) | 5 |
| 12. Security & Threat Defense | Boundary Organ | `boundary-organ` | tier-1 / native | nominal (100) | 5 |
| 12. Security & Threat Defense | Encryption Organ | `encryption-organ` | tier-1 / composed | nominal (100) | 5 |
| 12. Security & Threat Defense | Identity Guard | `identity-guard` | tier-1 / native | nominal (100) | 5 |
| 12. Security & Threat Defense | Intrusion Organ | `intrusion-organ` | tier-1 / composed | nominal (100) | 5 |
| 12. Security & Threat Defense | Permission Organ | `permission-organ` | tier-1 / native | nominal (100) | 5 |
| 12. Security & Threat Defense | Plugin Security Organ | `plugin-security-organ` | tier-1 / native | nominal (100) | 5 |
| 12. Security & Threat Defense | Security Auditor | `security-auditor` | tier-1 / native | nominal (100) | 5 |
| 12. Security & Threat Defense | Security Organ | `security-organ` | tier-1 / native | nominal (100) | 5 |
| 12. Security & Threat Defense | Threat Detection Organ | `threat-detection-organ` | tier-1 / composed | nominal (100) | 5 |
| 13. Drift Protection & Stability | Baseline Intelligence Organ | `baseline-intelligence-organ` | tier-1 / composed | nominal (100) | 5 |
| 13. Drift Protection & Stability | Behavior-Drift Monitor | `behavior-drift-monitor` | tier-1 / composed | nominal (100) | 5 |
| 13. Drift Protection & Stability | Consistency Organ | `consistency-organ` | tier-1 / composed | nominal (100) | 5 |
| 13. Drift Protection & Stability | Drift Auditor | `drift-auditor` | tier-1 / native | nominal (100) | 5 |
| 13. Drift Protection & Stability | Drift Protection Organ | `drift-protection-organ` | tier-1 / native | nominal (100) | 5 |
| 13. Drift Protection & Stability | Identity Anchor | `identity-anchor` | tier-1 / native | nominal (100) | 5 |
| 13. Drift Protection & Stability | Memory-Drift Monitor | `memory-drift-monitor` | tier-1 / composed | nominal (100) | 5 |
| 13. Drift Protection & Stability | Organ-Drift Monitor | `organ-drift-monitor` | tier-1 / composed | nominal (100) | 5 |
| 13. Drift Protection & Stability | Reasoning-Drift Monitor | `reasoning-drift-monitor` | tier-1 / composed | nominal (100) | 5 |
| 13. Drift Protection & Stability | Stability Organ | `stability-organ` | tier-1 / native | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Cross-Check Organ | `cross-check-organ` | tier-1 / composed | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Error-Suppression Organ | `error-suppression-organ` | tier-1 / native | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Hallucination Filter | `hallucination-filter` | tier-1 / composed | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Hallucination Sentinel | `hallucination-sentinel` | tier-1 / composed | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Reality Anchor Organ | `reality-anchor-organ` | tier-1 / native | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Reality Auditor | `reality-auditor` | tier-1 / native | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Reasoning-Guard Organ | `reasoning-guard-organ` | tier-1 / native | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Source Integrity Organ | `source-integrity-organ` | tier-1 / native | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Truth-Model Organ | `truth-model-organ` | tier-1 / composed | nominal (100) | 5 |
| 14. Hallucination Protection & Reality Anchoring | Verification Organ | `verification-organ` | tier-1 / native | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Cinematic Auditor | `cinematic-auditor` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Cinematic Organ | `cinematic-organ` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Continuity Organ | `continuity-organ` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Dialogue Organ | `dialogue-organ` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Interaction Style Organ | `interaction-style-organ` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Narrative Organ | `narrative-organ` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Persona Organ | `persona-organ` | tier-2 / native | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Scene Organ | `scene-organ` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Style Organ | `style-organ` | tier-2 / composed | nominal (100) | 5 |
| 15. Cinematic & Narrative Coherence | Tone Organ | `tone-organ` | tier-2 / composed | nominal (100) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Audit Organ | `tenant-audit-organ` | tier-1 / native | nominal (100) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Constitution Layer | `tenant-constitution-layer` | tier-1 / native | nominal (100) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Doctrine Layer | `tenant-doctrine-layer` | tier-1 / native | nominal (100) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Isolation Guard | `tenant-isolation-guard` | tier-1 / native | nominal (100) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Plugin Layer | `tenant-plugin-layer` | tier-1 / adapter | adapter-dormant (90) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Registry | `tenant-registry` | tier-1 / native | nominal (100) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Switcher Organ | `tenant-switcher-organ` | tier-1 / native | nominal (100) | 5 |
| 20. Multi-Tenant Enterprise | Tenant Workflow Layer | `tenant-workflow-layer` | tier-1 / composed | nominal (100) | 5 |

### Layer 7: OmniRouter-exclusive infrastructure, plugin registry, runtime, compute, cloud portability, and observability.

| Family | Organ | Identifier | Tier / mode | Health | Dependencies |
|---|---|---|---|---|---|
| 6. API & External Interface | API Recycling Layer | `api-recycling-layer` | tier-2 / native | nominal (100) | 5 |
| 6. API & External Interface | Calendar Organ | `calendar-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 6. API & External Interface | Email Organ | `email-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 6. API & External Interface | OmniRouter Organ | `omnirouter-organ` | tier-2 / native | nominal (100) | 5 |
| 6. API & External Interface | Payments Organ | `payments-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 6. API & External Interface | Phone Organ | `phone-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 6. API & External Interface | Plugin Registry Organ | `plugin-registry-organ` | tier-2 / native | nominal (100) | 5 |
| 6. API & External Interface | SMS Organ | `sms-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 6. API & External Interface | Social Graph Organ | `social-graph-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 6. API & External Interface | Webhook Organ | `webhook-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 7. Cloud Runtime & Infrastructure | Cloud Runtime Organ | `cloud-runtime-organ` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Container Organ | `container-organ` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Healthcheck Organ | `healthcheck-organ` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Liveness Probe Organ | `liveness-probe-organ` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Port Injection Organ | `port-injection-organ` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Resource Organ | `resource-organ` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Runtime Auditor | `runtime-auditor` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Scaling Organ | `scaling-organ` | tier-2 / composed | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Secrets Organ | `secrets-organ` | tier-2 / native | nominal (100) | 5 |
| 7. Cloud Runtime & Infrastructure | Startup Probe Organ | `startup-probe-organ` | tier-2 / native | nominal (100) | 5 |
| 18. Compute & Multi-Runtime | Acceleration Router | `acceleration-router` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 18. Compute & Multi-Runtime | Cluster Orchestrator | `cluster-orchestrator` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 18. Compute & Multi-Runtime | Device Capability Organ | `device-capability-organ` | tier-2 / native | nominal (100) | 5 |
| 18. Compute & Multi-Runtime | Distributed Compute Organ | `distributed-compute-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 18. Compute & Multi-Runtime | GPU Offload Organ | `gpu-offload-organ` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 18. Compute & Multi-Runtime | Parallel Compute Organ | `parallel-compute-organ` | tier-2 / native | nominal (100) | 5 |
| 18. Compute & Multi-Runtime | Server Runtime Organ | `server-runtime-organ` | tier-2 / native | nominal (100) | 5 |
| 18. Compute & Multi-Runtime | Tensor Engine | `tensor-engine` | tier-2 / adapter | adapter-dormant (90) | 5 |
| 21. Mission Control & Operator Interface | Agent Organ Workflow Visualizer | `agent-organ-workflow-visualizer` | tier-1 / composed | nominal (100) | 5 |
| 21. Mission Control & Operator Interface | Approval Control Organ | `approval-control-organ` | tier-1 / native | nominal (100) | 5 |
| 21. Mission Control & Operator Interface | Central OS UI Organ | `central-os-ui-organ` | tier-1 / native | nominal (100) | 5 |
| 21. Mission Control & Operator Interface | Holographic Head Organ | `holographic-head-organ` | tier-1 / native | nominal (100) | 5 |
| 21. Mission Control & Operator Interface | Mission Snapshot Organ | `mission-snapshot-organ` | tier-1 / native | nominal (100) | 5 |
| 21. Mission Control & Operator Interface | Safe Mode Control Organ | `safe-mode-control-organ` | tier-1 / native | nominal (100) | 5 |
| 21. Mission Control & Operator Interface | System Dashboard Organ | `system-dashboard-organ` | tier-1 / native | nominal (100) | 5 |
| 21. Mission Control & Operator Interface | Telemetry Viewer Organ | `telemetry-viewer-organ` | tier-1 / native | nominal (100) | 5 |

## Master Wiring and Operational Boundaries

| Connection class | Required governed path | Prohibited shortcut |
|---|---|---|
| Organ to organ | Declarative Organ Wiring Layer → Organ Kernel → recorded Paragon preflight | Direct execution between organs |
| Agent to agent | Agent Registry → Agent Router → Collaboration/Oversight/Arbitration → Paragon | Direct agent execution or authority transfer |
| Organ to agent | Telemetry/workflow evidence → Agent Router → bounded procedure → Paragon | Direct organ-triggered agent execution |
| External or provider action | Plugin Registry → Security gate → OmniRouter → Paragon decision → audit record | Direct HTTP/provider credential/network route |
| Web action | Organ Kernel → Paragon → Puppeteer Execution Control → durable evidence | Browser/network route outside Puppeteer controller |
| Evolution | Sandbox → validation → Paragon review → Craig approval where protected → approved adapter | Automatic mutation, merge, deploy, or activation |
| Repair | Failure/health evidence → sandbox repair proposal → validation → Paragon/Craig protected path | Automatic restart, replacement, patch, or production rollback |
| Tenant operation | Tenant context → protected route/runtime guard → tenant-scoped storage → Paragon | Cross-tenant read, write, approve, route, or execute |

## Bring-Up Readiness

The [governed bring-up control](src/autonomy/bring-up.ts) records the bootloader, organ, safety, evolution, compute, runtime, tenant, OS/UI, and agent initialization sequences. It emits durable first-heartbeat, first-cognition, first-stability-lock, first-safety-lock, first-Paragon-sync, first-tenant-sync, first-OS/UI-sync, and first-workflow-sync evidence. These are readiness attestations; they do not activate a provider, integration, remote compute, plugin, deployment, merge, or external action.

## Validation and Shipability Scope

The repository test suite validates the current control contract, including inventory size, Tier-0 decision enforcement, tenant isolation, safe mode, OmniRouter blocking, security input rejection, compute/web posture boundaries, multi-agent routing, self-healing, wiring, final audit/lock posture, and governed bring-up. Deployment readiness remains environment-dependent: the target must provide configured secrets through the environment contract, durable Supabase connectivity when required, and the documented cloud health-check configuration.

## Related Technical Documents

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture and runtime boundary design. |
| [LEVEL6_ARCHITECTURE.md](LEVEL6_ARCHITECTURE.md) | Eight foundational layers and enterprise overlays. |
| [WIRING_STATUS.md](WIRING_STATUS.md) | Wiring implementation and validation status. |
| [PRODUCTION_REQUIREMENTS.md](PRODUCTION_REQUIREMENTS.md) | Deployment environment and operational prerequisites. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker and cloud deployment procedures. |
| [ORGANS.md](ORGANS.md) | Family-oriented registry reference. |

_Generated from the Microfixd source registry. Regenerate with `npx tsx scripts/generate-system-summary.ts` after a registry or governance contract change._

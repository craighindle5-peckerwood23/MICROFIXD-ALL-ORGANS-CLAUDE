# Microfixd 200-Organ Registry Reference

Microfixd is organized as a **200-organ synthetic system across 21 families and eight foundational layers**. The organ roster is a runtime contract, not a marketing taxonomy: every organ has an immutable identity, a family, a Tier-1 or Tier-2 responsibility, an implementation mode, and a mandatory Tier-0 Paragon Dissector decision boundary. Paragon itself is the sole **Tier-0** organ and has no override path. For the registry-derived layer map, full 200-organ inventory, overlay controls, and governed wiring paths, see [COMPLETE_SYSTEM_SUMMARY.md](COMPLETE_SYSTEM_SUMMARY.md).

> An organ may execute a native internal operation, compose a governed workflow, or expose a disabled external-adapter boundary. An adapter does not gain provider credentials or network access by existing in the registry; it becomes operational only through Plugin Registry and OmniRouter after Paragon review.

| Implementation mode | Meaning |
|---|---|
| **Native** | A dedicated internal service currently implements the organ’s behavior. |
| **Composed** | The organ operates through the Organ Kernel, which composes native services under one Paragon decision trail. |
| **Adapter** | The organ has a complete governed interface but requires an allowlisted Plugin Registry connection before it can interact with an external service or machine. |

## Tier Model

| Tier | Authority |
|---|---|
| **Tier-0** | Paragon Dissector. It makes the final binding allow, escalate, or deny decision for every organ, current and future. |
| **Tier-1** | Constitutional control organs. They interpret doctrine, risk, security, drift, verification, and action limits; all remain subordinate to Tier-0. |
| **Tier-2** | Cognition, memory, execution, perception, output, cloud, automotive, and adapter organs. They perform bounded work only after a Tier-0 record exists. |

## Family 1 — Oversight & Governance

| Organ | Mode | Responsibility |
|---|---|---|
| Paragon Dissector | Native, Tier-0 | Final binding authority over every operation and organ. |
| Constitution Engine | Native | Supplies immutable system invariants to every evaluation. |
| Doctrine Engine | Composed | Maps doctrine to bounded operational rules. |
| Risk Governor | Native | Classifies action risk and cost escalation thresholds. |
| Ethics Organ | Composed | Checks requests against protected-action constraints. |
| Drift Monitor | Composed | Measures divergence from approved baselines. |
| Escalation Organ | Native | Creates Craig’s approval record for exceptions. |
| Policy Interpreter | Native | Converts policy evidence into allow, escalate, or deny conditions. |
| Safety Sentinel | Composed | Applies emergency-stop and resource protection rules. |
| Autonomy Regulator | Composed | Enforces bounded autonomy, budgets, and run limits. |

## Family 2 — Cognition & Intelligence

| Organ | Mode | Responsibility |
|---|---|---|
| Cognition Engine | Native | Builds bounded plans from goals and recalled experience. |
| Reflection Organ | Composed | Records post-run self-assessment and evidence gaps. |
| Planning Organ | Native | Produces ordered, governable action plans. |
| Inference Organ | Composed | Derives constrained implications from available facts. |
| Logic Organ | Composed | Applies deterministic consistency checks. |
| Understanding Organ | Composed | Classifies objective, scope, and ambiguity. |
| Interpretation Organ | Composed | Converts user intent into typed system operations. |
| Reasoning Matrix | Composed | Stores alternative reason paths and policy results. |
| Decision Organ | Composed | Selects only among Tier-0-approved alternatives. |
| Cognitive Map | Composed | Relates goals, plans, constraints, and memories. |

## Family 3 — Memory & Learning

| Organ | Mode | Responsibility |
|---|---|---|
| Memory Engine | Native | Coordinates durable memory operations. |
| Long-Term Memory Organ | Native | Persists episodic, semantic, procedural, and experience records. |
| Working Memory Organ | Native | Maintains run-local context and artifacts. |
| Memory Compression Organ | Composed | Condenses completed run evidence into retrieval-sized records. |
| Experience Recorder | Native | Saves scored outcomes for future planning. |
| Knowledge Graph Organ | Composed | Builds governed associations among memory concepts. |
| Recall Organ | Native | Retrieves relevant stored evidence by agent and query. |
| Learning Organ | Native | Applies auditable feedback scores to future context selection. |
| Skill Acquisition Organ | Composed | Stores validated capability candidates without activating them. |
| Memory Auditor | Composed | Detects retention, provenance, and consistency gaps. |

## Family 4 — Self-Modification & Evolution

| Organ | Mode | Responsibility |
|---|---|---|
| Self-Modifying Engine | Native | Coordinates candidate-only system improvement. |
| Sandbox Organ | Native | Creates path-confined, static-validation-only artifacts. |
| Mutation Organ | Composed | Produces bounded candidate variations in the sandbox. |
| Evolution Organ | Composed | Compares validated candidates against outcome evidence. |
| Refactor Organ | Composed | Generates refactor proposals without modifying active source. |
| Code Generation Organ | Composed | Produces capability candidate artifacts. |
| Module Builder | Composed | Packages candidate definitions for later review. |
| Deployment Organ | Adapter | Represents deployment actions; always protected and never autonomous. |
| Rollback Organ | Composed | Keeps candidate provenance and marks rejected changes. |
| Self-Audit Organ | Composed | Verifies the candidate’s containment, validation, and approval record. |

## Family 5 — Task & Workflow Execution

| Organ | Mode | Responsibility |
|---|---|---|
| Task Engine | Native | Creates and transitions durable goal runs. |
| Workflow Engine | Native | Interprets plans as bounded step sequences. |
| Scheduler Organ | Composed | Manages future schedules only within an explicit deployment configuration. |
| Retry Organ | Native | Enforces bounded retry policy for retry-safe operations. |
| Queue Organ | Composed | Holds pending and approval-blocked work. |
| Execution Organ | Native | Executes allowed internal actions. |
| Pipeline Organ | Composed | Tracks multi-stage operation dependencies. |
| Orchestration Organ | Native | Coordinates the approved organ sequence. |
| Progress Organ | Native | Records current step and telemetry. |
| Completion Organ | Native | Writes final outcome and learning record. |

## Family 6 — API & External Interface

| Organ | Mode | Responsibility |
|---|---|---|
| OmniRouter Organ | Native | Exclusive outbound request path with retries and fallback. |
| Plugin Registry Organ | Native | Owns allowlisted integration manifests and credential references. |
| API Recycling Layer | Native | Reuses cacheable results and prefers free routes. |
| Webhook Organ | Adapter | Receives or emits verified webhook interactions through Plugin Registry. |
| Email Organ | Adapter | Sends or receives email only through a registered route. |
| SMS Organ | Adapter | Uses a registered messaging provider through OmniRouter. |
| Phone Organ | Adapter | Uses a registered telephony provider through OmniRouter. |
| Calendar Organ | Adapter | Uses a registered calendar provider through OmniRouter. |
| Payments Organ | Adapter | Represents protected financial actions that require Craig approval. |
| Social Graph Organ | Adapter | Uses a registered social or relationship-data provider through OmniRouter. |

## Family 7 — Cloud Runtime & Infrastructure

| Organ | Mode | Responsibility |
|---|---|---|
| Cloud Runtime Organ | Native | Starts one portable HTTP process across supported clouds. |
| Port Injection Organ | Native | Consumes host-provided `PORT` safely. |
| Secrets Organ | Native | References environment variables without exposing values. |
| Healthcheck Organ | Native | Reports liveness state. |
| Startup Probe Organ | Native | Reports initialization readiness. |
| Liveness Probe Organ | Native | Reports process availability. |
| Scaling Organ | Composed | Publishes stateless scaling constraints and persistent-memory needs. |
| Resource Organ | Native | Reports bounded process and runtime resource state. |
| Container Organ | Native | Defines Docker-compatible build and execution contract. |
| Runtime Auditor | Native | Emits runtime posture, storage, and configuration evidence. |

## Family 8 — Automotive & Machine Interface

| Organ | Mode | Responsibility |
|---|---|---|
| OBD2 Organ | Adapter | Registered OBD2 connection boundary. |
| ECM Organ | Adapter | Registered engine-control interface boundary. |
| TCM Organ | Adapter | Registered transmission-control interface boundary. |
| BCM Organ | Adapter | Registered body-control interface boundary. |
| ECU Organ | Adapter | Registered electronic-control interface boundary. |
| CANBus Organ | Adapter | Registered CAN-bus interface boundary. |
| VIN Organ | Adapter | Registered vehicle-identity lookup boundary. |
| FreezeFrame Organ | Adapter | Registered diagnostic freeze-frame boundary. |
| Sensor Organ | Adapter | Registered sensor telemetry boundary. |
| Diagnostics Organ | Composed | Normalizes approved automotive evidence without commanding a vehicle. |

## Family 9 — Perception & Input

| Organ | Mode | Responsibility |
|---|---|---|
| Vision Organ | Adapter | Registered image or vision-model boundary. |
| Audio Organ | Adapter | Registered speech/audio boundary. |
| Text Organ | Native | Accepts typed goal and command inputs. |
| Intent Organ | Native | Classifies declared objective and action category. |
| Context Organ | Native | Supplies run context and recalled memory. |
| Signal Organ | Composed | Normalizes structured input signals. |
| Pattern Organ | Composed | Identifies deterministic recurring evidence patterns. |
| Classifier Organ | Composed | Assigns bounded categories to permitted input. |
| Translator Organ | Adapter | Registered translation-model boundary. |
| Perception Auditor | Composed | Records source, confidence, and evidence limitations. |

## Family 10 — Output & Interaction

| Organ | Mode | Responsibility |
|---|---|---|
| Response Organ | Native | Produces governed operation responses. |
| UI Organ | Native | Provides the Tier-0 operations console. |
| Action Organ | Native | Represents the approved operation to perform. |
| Command Organ | Composed | Parses typed commands into bounded goal inputs. |
| Execution Output Organ | Native | Stores result payloads and state transitions. |
| Formatting Organ | Native | Produces structured JSON and console-safe text. |
| Delivery Organ | Adapter | Uses a registered destination through OmniRouter. |
| Interaction Organ | Native | Handles console requests and approval review. |
| Behavior Organ | Composed | Applies permitted interaction-state rules. |
| Output Auditor | Composed | Records response provenance and decision context. |

## Family 11 — Puppeteer & Execution Control

| Organ | Mode | Responsibility |
|---|---|---|
| Puppeteer Organ | Composed | Master controller for Tier-0-approved action sequencing; it is not an unrestricted browser or shell executor. |
| Action Governor | Native | Limits disallowed or high-risk actions. |
| Execution Stabilizer | Native | Enforces transition, timeout, and retry bounds. |
| Behavior Router | Composed | Routes an approved action to the correct organ family. |
| Intent-to-Action Organ | Composed | Converts validated intent into typed actions. |
| Motor Logic Organ | Composed | Applies deterministic action-state mechanics. |
| Workflow Puppeteer | Native | Coordinates multi-step execution state. |
| Command Interpreter | Native | Safely interprets commands into bounded operations. |
| Action Auditor | Native | Records every execution attempt and result. |
| Action Rollback Organ | Composed | Preserves rollback or denial records for candidate actions. |

## Family 12 — Security & Threat Defense

| Organ | Mode | Responsibility |
|---|---|---|
| Security Organ | Native | Coordinates security posture and protected-action controls. |
| Threat Detection Organ | Composed | Detects prohibited patterns and policy conflicts. |
| Intrusion Organ | Composed | Detects invalid privileged access attempts. |
| Permission Organ | Native | Validates administrative access for privileged endpoints. |
| Boundary Organ | Native | Enforces path, network, and execution containment. |
| Encryption Organ | Composed | Defines encrypted-transport and secret-handling requirements. |
| Identity Guard | Native | Requires named operator identity for exception decisions. |
| API Shield Organ | Native | Enforces authenticated protected API access. |
| Plugin Security Organ | Native | Validates allowlisted plugin manifest constraints. |
| Security Auditor | Native | Emits security-relevant audit evidence. |

## Family 13 — Drift Protection & Stability

| Organ | Mode | Responsibility |
|---|---|---|
| Drift Protection Organ | Native | Coordinates baseline comparison. |
| Stability Organ | Native | Enforces loop, retry, and state-transition limits. |
| Consistency Organ | Composed | Checks compatible run and memory states. |
| Baseline Intelligence Organ | Composed | Tracks approved behavior baseline. |
| Identity Anchor | Native | Pins system constitution and identity claims. |
| Memory-Drift Monitor | Composed | Detects memory changes lacking provenance. |
| Reasoning-Drift Monitor | Composed | Detects plan steps that depart from approved scope. |
| Behavior-Drift Monitor | Composed | Detects unexpected state-transition patterns. |
| Organ-Drift Monitor | Composed | Detects registry or contract changes. |
| Drift Auditor | Native | Writes drift findings to the audit trail. |

## Family 14 — Hallucination Protection & Reality Anchoring

| Organ | Mode | Responsibility |
|---|---|---|
| Hallucination Filter | Composed | Blocks unsupported factual certainty from result text. |
| Reality Anchor Organ | Native | Marks evidence origin and stated uncertainty. |
| Verification Organ | Native | Requires validation evidence for capability claims. |
| Cross-Check Organ | Composed | Compares independent deterministic checks where available. |
| Source Integrity Organ | Native | Records source and route provenance. |
| Truth-Model Organ | Composed | Maintains claim-versus-evidence distinction. |
| Error-Suppression Organ | Native | Prevents raw provider or secret data from surfacing. |
| Reasoning-Guard Organ | Native | Restricts unsupported inferences and protected actions. |
| Hallucination Sentinel | Composed | Flags evidence gaps for escalation or qualification. |
| Reality Auditor | Native | Emits verification and uncertainty evidence. |

## Family 15 — Cinematic & Narrative Coherence

| Organ | Mode | Responsibility |
|---|---|---|
| Cinematic Organ | Composed | Maintains presentation coherence; it does not override truth or policy. |
| Narrative Organ | Composed | Organizes operation events into an accurate chronology. |
| Tone Organ | Composed | Applies selected professional interaction tone. |
| Style Organ | Composed | Applies consistent output formatting. |
| Persona Organ | Native | Pins the Microfixd system identity to its constitution. |
| Dialogue Organ | Composed | Maintains bounded conversational context. |
| Interaction Style Organ | Composed | Applies predictable human interaction conventions. |
| Continuity Organ | Composed | Preserves run and session continuity without inventing events. |
| Scene Organ | Composed | Segments workflow phases for inspection. |
| Cinematic Auditor | Composed | Checks that narrative presentation does not hide uncertainty or alter records. |

## Operational Invariants

The Organ Kernel registers every definition at boot. A Tier-2 organ can invoke only its assigned native service, a composed service through the kernel, or an external adapter through OmniRouter. **No organ can issue a raw outbound request, execute unrestricted host code, change the constitution, activate a candidate module, or override Paragon Dissector.**

The complete roster is therefore present as executable architecture now. External-adapter organs remain intentionally dormant until a corresponding Plugin Registry manifest is configured, authenticated, and approved; this protects the system from fictional integrations and unauthorized external effects.

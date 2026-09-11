export type OrganMode = 'native' | 'composed' | 'adapter';
export type OrganTier = 'tier-0' | 'tier-1' | 'tier-2';

export type OrganMetadata = {
  status: 'active' | 'adapter-dormant';
  health: { score: number; state: 'nominal' | 'adapter-dormant'; source: string };
  permissions: string[];
  dependencies: string[];
  wiringMapId: string;
  runtimeContext: { layer: number; family: string; executionBoundary: string };
  telemetryEndpoint: string;
  paragonOversightHook: string;
  sandboxCompatible: boolean;
  githubModuleMapping: { path: string; status: 'implemented' | 'adapter-boundary' };
  tenantIsolated: true;
};

export type OrganDefinition = {
  id: string;
  name: string;
  family: string;
  familyNumber: number;
  layer: number;
  version: string;
  tier: OrganTier;
  mode: OrganMode;
  guidedPath: string;
  finalAuthority: 'Paragon Dissector';
  metadata: OrganMetadata;
};

type Family = { number: number; layer: number; name: string; tier: OrganTier; organs: string[] };

const families: Family[] = [
  { number: 1, layer: 0, name: 'Oversight & Governance', tier: 'tier-1', organs: ['Paragon Dissector', 'Constitution Engine', 'Doctrine Engine', 'Risk Governor', 'Ethics Organ', 'Drift Monitor', 'Escalation Organ', 'Policy Interpreter', 'Safety Sentinel', 'Autonomy Regulator'] },
  { number: 2, layer: 2, name: 'Cognition & Intelligence', tier: 'tier-2', organs: ['Cognition Engine', 'Reflection Organ', 'Planning Organ', 'Inference Organ', 'Logic Organ', 'Understanding Organ', 'Interpretation Organ', 'Reasoning Matrix', 'Decision Organ', 'Cognitive Map', 'Hypothetical Organ'] },
  { number: 3, layer: 3, name: 'Memory & Learning', tier: 'tier-2', organs: ['Memory Engine', 'Long-Term Memory Organ', 'Working Memory Organ', 'Memory Compression Organ', 'Experience Recorder', 'Knowledge Graph Organ', 'Recall Organ', 'Learning Organ', 'Skill Acquisition Organ', 'Memory Auditor'] },
  { number: 4, layer: 5, name: 'Self-Modification & Evolution', tier: 'tier-2', organs: ['Self-Modifying Engine', 'Sandbox Organ', 'Mutation Organ', 'Evolution Organ', 'Refactor Organ', 'Code Generation Organ', 'Module Builder', 'Deployment Organ', 'Rollback Organ', 'Self-Audit Organ'] },
  { number: 5, layer: 4, name: 'Task & Workflow Execution', tier: 'tier-2', organs: ['Task Engine', 'Workflow Engine', 'Scheduler Organ', 'Retry Organ', 'Queue Organ', 'Execution Organ', 'Pipeline Organ', 'Orchestration Organ', 'Progress Organ', 'Completion Organ'] },
  { number: 6, layer: 7, name: 'API & External Interface', tier: 'tier-2', organs: ['OmniRouter Organ', 'Plugin Registry Organ', 'API Recycling Layer', 'Webhook Organ', 'Email Organ', 'SMS Organ', 'Phone Organ', 'Calendar Organ', 'Payments Organ', 'Social Graph Organ'] },
  { number: 7, layer: 7, name: 'Cloud Runtime & Infrastructure', tier: 'tier-2', organs: ['Cloud Runtime Organ', 'Port Injection Organ', 'Secrets Organ', 'Healthcheck Organ', 'Startup Probe Organ', 'Liveness Probe Organ', 'Scaling Organ', 'Resource Organ', 'Container Organ', 'Runtime Auditor'] },
  { number: 8, layer: 4, name: 'Automotive & Machine Interface', tier: 'tier-2', organs: ['OBD2 Organ', 'ECM Organ', 'TCM Organ', 'BCM Organ', 'ECU Organ', 'CANBus Organ', 'VIN Organ', 'FreezeFrame Organ', 'Sensor Organ', 'Diagnostics Organ'] },
  { number: 9, layer: 2, name: 'Perception & Input', tier: 'tier-2', organs: ['Vision Organ', 'Audio Organ', 'Text Organ', 'Intent Organ', 'Context Organ', 'Signal Organ', 'Pattern Organ', 'Classifier Organ', 'Translator Organ', 'Perception Auditor'] },
  { number: 10, layer: 4, name: 'Output & Interaction', tier: 'tier-2', organs: ['Response Organ', 'UI Organ', 'Action Organ', 'Command Organ', 'Execution Output Organ', 'Formatting Organ', 'Delivery Organ', 'Interaction Organ', 'Behavior Organ', 'Output Auditor'] },
  { number: 11, layer: 4, name: 'Puppeteer & Execution Control', tier: 'tier-1', organs: ['Puppeteer Organ', 'Action Governor', 'Execution Stabilizer', 'Behavior Router', 'Intent-to-Action Organ', 'Motor Logic Organ', 'Workflow Puppeteer', 'Command Interpreter', 'Action Auditor', 'Action Rollback Organ'] },
  { number: 12, layer: 6, name: 'Security & Threat Defense', tier: 'tier-1', organs: ['Security Organ', 'Threat Detection Organ', 'Intrusion Organ', 'Permission Organ', 'Boundary Organ', 'Encryption Organ', 'Identity Guard', 'API Shield Organ', 'Plugin Security Organ', 'Security Auditor'] },
  { number: 13, layer: 6, name: 'Drift Protection & Stability', tier: 'tier-1', organs: ['Drift Protection Organ', 'Stability Organ', 'Consistency Organ', 'Baseline Intelligence Organ', 'Identity Anchor', 'Memory-Drift Monitor', 'Reasoning-Drift Monitor', 'Behavior-Drift Monitor', 'Organ-Drift Monitor', 'Drift Auditor'] },
  { number: 14, layer: 6, name: 'Hallucination Protection & Reality Anchoring', tier: 'tier-1', organs: ['Hallucination Filter', 'Reality Anchor Organ', 'Verification Organ', 'Cross-Check Organ', 'Source Integrity Organ', 'Truth-Model Organ', 'Error-Suppression Organ', 'Reasoning-Guard Organ', 'Hallucination Sentinel', 'Reality Auditor'] },
  { number: 15, layer: 6, name: 'Cinematic & Narrative Coherence', tier: 'tier-2', organs: ['Cinematic Organ', 'Narrative Organ', 'Tone Organ', 'Style Organ', 'Persona Organ', 'Dialogue Organ', 'Interaction Style Organ', 'Continuity Organ', 'Scene Organ', 'Cinematic Auditor'] },
  { number: 16, layer: 1, name: 'Organ Lifecycle & Repair', tier: 'tier-1', organs: ['Organ Boot Layer', 'Organ Wiring Layer', 'Organ Telemetry Organ', 'Organ Repair Engine', 'Runtime Repair Organ', 'Failure Detection Organ', 'Health Trigger Organ', 'Repair Validator'] },
  { number: 17, layer: 2, name: 'Multi-Agent Cognitive System', tier: 'tier-1', organs: ['Agent Registry', 'Agent Router', 'Agent Collaboration Organ', 'Agent Oversight Organ', 'Agent Arbitration Organ', 'Planner Agent', 'Critic Safety Agent', 'Builder Agent', 'Repair Agent', 'Reflection Agent', 'Meta-Agent'] },
  { number: 18, layer: 7, name: 'Compute & Multi-Runtime', tier: 'tier-2', organs: ['GPU Offload Organ', 'Parallel Compute Organ', 'Tensor Engine', 'Acceleration Router', 'Server Runtime Organ', 'Distributed Compute Organ', 'Cluster Orchestrator', 'Device Capability Organ'] },
  { number: 19, layer: 5, name: 'Governed Web & Source Control', tier: 'tier-1', organs: ['Web Automation Organ', 'Browser Organ', 'Web Interaction Organ', 'Domain Allowlist Organ', 'GitHub Connector Organ', 'CI CD Gate Organ', 'Change Request Organ'] },
  { number: 20, layer: 6, name: 'Multi-Tenant Enterprise', tier: 'tier-1', organs: ['Tenant Registry', 'Tenant Constitution Layer', 'Tenant Doctrine Layer', 'Tenant Plugin Layer', 'Tenant Workflow Layer', 'Tenant Isolation Guard', 'Tenant Audit Organ', 'Tenant Switcher Organ'] },
  { number: 21, layer: 7, name: 'Mission Control & Operator Interface', tier: 'tier-1', organs: ['Central OS UI Organ', 'Holographic Head Organ', 'System Dashboard Organ', 'Agent Organ Workflow Visualizer', 'Approval Control Organ', 'Safe Mode Control Organ', 'Telemetry Viewer Organ', 'Mission Snapshot Organ'] },
];

const native = new Set([
  'Paragon Dissector', 'Constitution Engine', 'Risk Governor', 'Escalation Organ', 'Policy Interpreter', 'Cognition Engine', 'Planning Organ', 'Hypothetical Organ', 'Memory Engine', 'Long-Term Memory Organ', 'Working Memory Organ', 'Experience Recorder', 'Recall Organ', 'Learning Organ', 'Self-Modifying Engine', 'Sandbox Organ', 'Task Engine', 'Workflow Engine', 'Retry Organ', 'Execution Organ', 'Orchestration Organ', 'Progress Organ', 'Completion Organ', 'OmniRouter Organ', 'Plugin Registry Organ', 'API Recycling Layer', 'Cloud Runtime Organ', 'Port Injection Organ', 'Secrets Organ', 'Healthcheck Organ', 'Startup Probe Organ', 'Liveness Probe Organ', 'Resource Organ', 'Container Organ', 'Runtime Auditor', 'Text Organ', 'Intent Organ', 'Context Organ', 'Response Organ', 'UI Organ', 'Action Organ', 'Execution Output Organ', 'Formatting Organ', 'Interaction Organ', 'Action Governor', 'Execution Stabilizer', 'Workflow Puppeteer', 'Command Interpreter', 'Action Auditor', 'Security Organ', 'Permission Organ', 'Boundary Organ', 'Identity Guard', 'API Shield Organ', 'Plugin Security Organ', 'Security Auditor', 'Drift Protection Organ', 'Stability Organ', 'Identity Anchor', 'Drift Auditor', 'Reality Anchor Organ', 'Verification Organ', 'Source Integrity Organ', 'Error-Suppression Organ', 'Reasoning-Guard Organ', 'Reality Auditor', 'Persona Organ',
  'Organ Boot Layer', 'Organ Wiring Layer', 'Organ Telemetry Organ', 'Failure Detection Organ', 'Health Trigger Organ', 'Agent Registry', 'Agent Router', 'Agent Collaboration Organ', 'Agent Oversight Organ', 'Agent Arbitration Organ', 'Device Capability Organ', 'Parallel Compute Organ', 'Server Runtime Organ', 'Domain Allowlist Organ', 'Tenant Registry', 'Tenant Constitution Layer', 'Tenant Doctrine Layer', 'Tenant Isolation Guard', 'Tenant Audit Organ', 'Tenant Switcher Organ', 'Central OS UI Organ', 'Holographic Head Organ', 'System Dashboard Organ', 'Approval Control Organ', 'Safe Mode Control Organ', 'Telemetry Viewer Organ', 'Mission Snapshot Organ',
]);

const adapters = new Set([
  'Deployment Organ', 'Webhook Organ', 'Email Organ', 'SMS Organ', 'Phone Organ', 'Calendar Organ', 'Payments Organ', 'Social Graph Organ', 'OBD2 Organ', 'ECM Organ', 'TCM Organ', 'BCM Organ', 'ECU Organ', 'CANBus Organ', 'VIN Organ', 'FreezeFrame Organ', 'Sensor Organ', 'Vision Organ', 'Audio Organ', 'Translator Organ', 'Delivery Organ',
  'GPU Offload Organ', 'Tensor Engine', 'Acceleration Router', 'Distributed Compute Organ', 'Cluster Orchestrator', 'Web Automation Organ', 'Browser Organ', 'Web Interaction Organ', 'GitHub Connector Organ', 'CI CD Gate Organ', 'Tenant Plugin Layer',
]);

const slugify = (value: string): string => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const moduleForLayer = (layer: number): string => ({
  0: 'src/autonomy/governance.ts', 1: 'src/autonomy/organ-lifecycle.ts', 2: 'src/autonomy/level6.ts', 3: 'src/autonomy/store.ts',
  4: 'src/autonomy/runtime.ts', 5: 'src/autonomy/sandbox.ts', 6: 'src/autonomy/security.ts', 7: 'src/autonomy/routes.ts',
}[layer] || 'src/autonomy/runtime.ts');

const metadataFor = (id: string, name: string, family: Family, mode: OrganMode, tier: OrganTier): OrganMetadata => ({
  status: mode === 'adapter' ? 'adapter-dormant' : 'active',
  health: { score: mode === 'adapter' ? 90 : 100, state: mode === 'adapter' ? 'adapter-dormant' : 'nominal', source: 'Organ Lifecycle baseline at deterministic boot' },
  permissions: mode === 'adapter' ? ['inspect:metadata', 'prepare:governed-route'] : ['inspect:state', 'prepare:bounded-procedure'],
  dependencies: id === 'constitution-engine' ? [] : ['constitution-engine', 'doctrine-engine', 'identity-anchor', 'autonomy-regulator', 'paragon-dissector'],
  wiringMapId: `wiring:${id}:2.0.0`,
  runtimeContext: { layer: family.layer, family: family.name, executionBoundary: mode === 'adapter' ? 'Plugin Registry and OmniRouter adapter; dormant without an approved manifest.' : 'Organ Kernel only; every operation records a Tier-0 Paragon decision.' },
  telemetryEndpoint: `/metrics#organ_${id.replace(/-/g, '_')}`,
  paragonOversightHook: 'Paragon Dissector.evaluate before Organ Kernel procedure or adapter route.',
  sandboxCompatible: true,
  githubModuleMapping: { path: moduleForLayer(family.layer), status: mode === 'adapter' ? 'adapter-boundary' : 'implemented' },
  tenantIsolated: true,
});

export const ORGAN_REGISTRY: readonly OrganDefinition[] = Object.freeze(families.flatMap((family) => family.organs.map((name) => {
  const isParagon = name === 'Paragon Dissector';
  const id = slugify(name);
  const mode = (native.has(name) ? 'native' : adapters.has(name) ? 'adapter' : 'composed') as OrganMode;
  const tier = isParagon ? 'tier-0' : family.tier;
  return {
    id, name, family: family.name, familyNumber: family.number, layer: family.layer, version: '2.0.0', tier, mode,
    guidedPath: `/api/autonomy/organs/${id}`,
    finalAuthority: 'Paragon Dissector' as const,
    metadata: metadataFor(id, name, family, mode, tier),
  };
})));

if (ORGAN_REGISTRY.length !== 201) throw new Error(`Organ registry integrity error: expected 201 organs, received ${ORGAN_REGISTRY.length}.`);
if (new Set(ORGAN_REGISTRY.map((organ) => organ.id)).size !== ORGAN_REGISTRY.length) throw new Error('Organ registry integrity error: organ identifiers must be unique.');

export const listOrgans = (): OrganDefinition[] => ORGAN_REGISTRY.map((organ) => ({ ...organ }));
export const getOrgan = (id: string): OrganDefinition | undefined => ORGAN_REGISTRY.find((organ) => organ.id === id);
export const organSummary = (): { total: number; native: number; composed: number; adapter: number; families: number; layers: number; tier0: string } => ({
  total: ORGAN_REGISTRY.length,
  native: ORGAN_REGISTRY.filter((organ) => organ.mode === 'native').length,
  composed: ORGAN_REGISTRY.filter((organ) => organ.mode === 'composed').length,
  adapter: ORGAN_REGISTRY.filter((organ) => organ.mode === 'adapter').length,
  families: families.length,
  layers: new Set(ORGAN_REGISTRY.map((organ) => organ.layer)).size,
  tier0: 'Paragon Dissector',
});

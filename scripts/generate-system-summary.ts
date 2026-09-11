import { writeFile } from 'node:fs/promises';
import { ORGAN_REGISTRY, organSummary } from '../src/autonomy/organ-registry.ts';
import { AGENT_ROLES } from '../src/autonomy/level6.ts';
import { CONSTITUTION, DOCTRINE } from '../src/autonomy/governance.ts';

const output = new URL('../COMPLETE_SYSTEM_SUMMARY.md', import.meta.url);
const summary = organSummary();
const markdown = (value: string): string => value.replaceAll('|', '\\|');

const layerDescriptions: Record<number, string> = {
  0: 'Identity, constitution, doctrine, and Tier-0 governance.',
  1: 'Organ lifecycle, registry integrity, declarative wiring, and health evidence.',
  2: 'Cognitive planning, assessment, mapping, and drift evidence.',
  3: 'Tenant-isolated memory routing, recall, compression proposals, and memory posture.',
  4: 'Bounded workflow and task execution, Puppeteer-only web authority, and execution evidence.',
  5: 'Sandbox-only evolution candidates, GitHub/CI-CD boundaries, change control, and rollback evidence.',
  6: 'Safety, security, drift, reality anchoring, fallback, and approval boundaries.',
  7: 'OmniRouter-exclusive infrastructure, plugin registry, runtime, compute, cloud portability, and observability.',
};

const lines: string[] = [
  '# Microfixd Complete-Organism Summary',
  '',
  '> **Runtime-derived inventory.** This document is generated from the authoritative 200-organ registry and source-level governance contracts. It describes implemented controls and declared adapter boundaries; it does not claim unconfigured third-party integrations, physical source-code immutability, or autonomous production activation.',
  '',
  `Microfixd currently registers **${summary.total} organs**, **${summary.families} families**, and **${summary.layers} foundational layers**. Every registered organ is tenant-isolated, is subject to a Paragon Dissector oversight hook, and must use the Organ Kernel for governed procedures. The primary system authority is the [Paragon Dissector](src/autonomy/governance.ts); the complete registry is defined in [organ-registry.ts](src/autonomy/organ-registry.ts).`,
  '',
  '## Guided System Map',
  '',
  '| Surface | Canonical implementation | Evidence / inspection surface |',
  '|---|---|---|',
  '| Constitution and doctrine | [governance.ts](src/autonomy/governance.ts) | `GET /api/autonomy/governance-lock` |',
  '| Organ registry and lifecycle | [organ-registry.ts](src/autonomy/organ-registry.ts), [organ-lifecycle.ts](src/autonomy/organ-lifecycle.ts) | `GET /api/autonomy/wiring` |',
  '| Cognition and reflection | [cognition.ts](src/autonomy/cognition.ts), [auxiliary-organs.ts](src/autonomy/auxiliary-organs.ts) | Run metacognition evidence |',
  '| Tenant memory | [memory.ts](src/autonomy/memory.ts) | `GET /api/autonomy/memory/posture` |',
  '| Bounded execution and web use | [execution.ts](src/autonomy/execution.ts) | `GET /api/autonomy/web/posture` |',
  '| Sandbox-only evolution | [evolution.ts](src/autonomy/evolution.ts) | Protected change-control routes |',
  '| Infrastructure and compute | [infrastructure.ts](src/autonomy/infrastructure.ts), [level6.ts](src/autonomy/level6.ts) | `GET /api/autonomy/infrastructure`, `GET /api/autonomy/compute` |',
  '| Multi-agent workforce | [level6.ts](src/autonomy/level6.ts) | `GET /api/autonomy/agents/posture` |',
  '| Self-healing evidence | [self-healing.ts](src/autonomy/self-healing.ts) | `GET /api/autonomy/self-healing` |',
  '| Master wiring | [system-wiring.ts](src/autonomy/system-wiring.ts) | `GET /api/autonomy/wiring` |',
  '| Final audit and lock posture | [final-audit.ts](src/autonomy/final-audit.ts) | `GET /api/autonomy/audit`, `GET /api/autonomy/governance-lock` |',
  '| Governed bring-up | [bring-up.ts](src/autonomy/bring-up.ts) | `GET /api/autonomy/bring-up` |',
  '| Holographic Mission Control | [OperationsConsole.tsx](src/OperationsConsole.tsx) | Protected tenant-scoped UI |',
  '',
  '## Constitutional and Doctrine Hooks',
  '',
  `The frozen constitution is **v${CONSTITUTION.version}** and has **${CONSTITUTION.invariants.length} invariants**. The frozen doctrine is **v${DOCTRINE.version}** and has **${DOCTRINE.invariants.length} invariants**. Both contracts are attested by the governance-lock evidence record; the lock records runtime posture and does not replace protected source, database, deployment, or adapter change control.`,
  '',
  '| Contract | Binding rule |',
  '|---|---|',
  `| Constitution | ${markdown(CONSTITUTION.authority)} |`,
  `| Doctrine | ${markdown(DOCTRINE.authority)} |`,
  '| Paragon | Tier-0 final decision authority. No bypass path is represented in the registry, wiring map, routes, or execution procedure. |',
  '| OmniRouter | Exclusive outbound path; Plugin Registry and Paragon govern every provider route. |',
  '| Tenant isolation | Runs, memory, agents, approvals, posture records, and workflow evidence carry tenant context. |',
  '| Evolution | Candidates are sandbox-only; activation, merge, deploy, rollback, and protected changes require separate Paragon/Craig/adapter evidence. |',
  '',
  '## Foundational Layers',
  '',
  '| Layer | Purpose | Organs | Families represented |',
  '|---:|---|---:|---:|',
];

for (let layer = 0; layer < 8; layer += 1) {
  const organs = ORGAN_REGISTRY.filter((organ) => organ.layer === layer);
  lines.push(`| ${layer} | ${layerDescriptions[layer]} | ${organs.length} | ${new Set(organs.map((organ) => organ.family)).size} |`);
}

lines.push('', '## Enterprise and Operational Overlays', '', '| Overlay | Implemented controlled surface | Primary evidence |', '|---|---|---|', '| Multi-tenant enterprise | Tenant profile, isolated approvals, memory, agent registry, compute, safety, evolution, and posture records. | Tenant Control Plane and protected tenant APIs |', '| Governed compute | Read-only local topology with dormant remote, distributed, GPU, and cluster adapter paths. | Compute profile records |', '| Governed web use | Puppeteer-only browser authority, reality anchoring, and security gate before OmniRouter routing. | Web-use posture records |', '| Multi-agent workforce | Six versioned, tenant-isolated roles routed through Agent Router, collaboration, oversight, and arbitration evidence. | Agent and agent-execution records |', '| Self-healing | Failure detection, health assessment, evidence-preserving fallback, and sandbox-only repair proposals. | Health-assessment and repair-proposal records |', '| Master wiring | Declarative organ edges and cross-cutting no-bypass topology validation. | Organ-wiring records |', '| Final audit and lock-in | Evidence-based certification and frozen runtime-contract attestation. | Audit-assessment and governance-lock records |', '| Governed bring-up | Strict first-boot sequence, readiness, and first synchronization evidence. | Organ-boot records |', '', '## Multi-Agent Workforce', '', '| Initialization order | Agent | Role boundary |', '|---:|---|---|');
const roleNames: Record<string, string> = { 'meta-agent': 'Meta-Agent', 'critic-safety': 'Critic / Safety Agent', reflection: 'Reflection Agent', planner: 'Planner Agent', builder: 'Builder Agent', repair: 'Repair Agent' };
AGENT_ROLES.forEach((role, index) => lines.push(`| ${index + 1} | ${roleNames[role]} | Tenant-scoped evidence, bounded responsibility, no direct provider, web, production, cross-tenant, merge, deploy, or Paragon-bypass authority. |`));

lines.push('', '## Full 200-Organ Inventory', '', '> Each record below is drawn directly from `ORGAN_REGISTRY`. **Mode** identifies implementation shape, not authority. Every item remains subject to Tier-0 Paragon oversight, Organ Kernel procedure boundaries, tenant isolation, and recorded telemetry.', '');
for (let layer = 0; layer < 8; layer += 1) {
  const organs = ORGAN_REGISTRY.filter((organ) => organ.layer === layer).sort((a, b) => a.familyNumber - b.familyNumber || a.name.localeCompare(b.name));
  lines.push(`### Layer ${layer}: ${layerDescriptions[layer]}`, '', '| Family | Organ | Identifier | Tier / mode | Health | Dependencies |', '|---|---|---|---|---|---|');
  for (const organ of organs) {
    lines.push(`| ${organ.familyNumber}. ${markdown(organ.family)} | ${markdown(organ.name)} | \`${organ.id}\` | ${organ.tier} / ${organ.mode} | ${organ.metadata.health.state} (${organ.metadata.health.score}) | ${organ.metadata.dependencies.length} |`);
  }
  lines.push('');
}

lines.push('## Master Wiring and Operational Boundaries', '', '| Connection class | Required governed path | Prohibited shortcut |', '|---|---|---|', '| Organ to organ | Declarative Organ Wiring Layer → Organ Kernel → recorded Paragon preflight | Direct execution between organs |', '| Agent to agent | Agent Registry → Agent Router → Collaboration/Oversight/Arbitration → Paragon | Direct agent execution or authority transfer |', '| Organ to agent | Telemetry/workflow evidence → Agent Router → bounded procedure → Paragon | Direct organ-triggered agent execution |', '| External or provider action | Plugin Registry → Security gate → OmniRouter → Paragon decision → audit record | Direct HTTP/provider credential/network route |', '| Web action | Organ Kernel → Paragon → Puppeteer Execution Control → durable evidence | Browser/network route outside Puppeteer controller |', '| Evolution | Sandbox → validation → Paragon review → Craig approval where protected → approved adapter | Automatic mutation, merge, deploy, or activation |', '| Repair | Failure/health evidence → sandbox repair proposal → validation → Paragon/Craig protected path | Automatic restart, replacement, patch, or production rollback |', '| Tenant operation | Tenant context → protected route/runtime guard → tenant-scoped storage → Paragon | Cross-tenant read, write, approve, route, or execute |', '', '## Bring-Up Readiness', '', 'The [governed bring-up control](src/autonomy/bring-up.ts) records the bootloader, organ, safety, evolution, compute, runtime, tenant, OS/UI, and agent initialization sequences. It emits durable first-heartbeat, first-cognition, first-stability-lock, first-safety-lock, first-Paragon-sync, first-tenant-sync, first-OS/UI-sync, and first-workflow-sync evidence. These are readiness attestations; they do not activate a provider, integration, remote compute, plugin, deployment, merge, or external action.', '', '## Validation and Shipability Scope', '', 'The repository test suite validates the current control contract, including inventory size, Tier-0 decision enforcement, tenant isolation, safe mode, OmniRouter blocking, security input rejection, compute/web posture boundaries, multi-agent routing, self-healing, wiring, final audit/lock posture, and governed bring-up. Deployment readiness remains environment-dependent: the target must provide configured secrets through the environment contract, durable Supabase connectivity when required, and the documented cloud health-check configuration.', '', '## Related Technical Documents', '', '| Document | Purpose |', '|---|---|', '| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture and runtime boundary design. |', '| [LEVEL6_ARCHITECTURE.md](LEVEL6_ARCHITECTURE.md) | Eight foundational layers and enterprise overlays. |', '| [WIRING_STATUS.md](WIRING_STATUS.md) | Wiring implementation and validation status. |', '| [PRODUCTION_REQUIREMENTS.md](PRODUCTION_REQUIREMENTS.md) | Deployment environment and operational prerequisites. |', '| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker and cloud deployment procedures. |', '| [ORGANS.md](ORGANS.md) | Family-oriented registry reference. |', '', '_Generated from the Microfixd source registry. Regenerate with `npx tsx scripts/generate-system-summary.ts` after a registry or governance contract change._', '');

await writeFile(output, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${output.pathname} with ${ORGAN_REGISTRY.length} organs.`);

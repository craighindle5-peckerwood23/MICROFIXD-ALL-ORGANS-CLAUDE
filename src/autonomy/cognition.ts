import { randomUUID } from 'node:crypto';
import { ORGAN_REGISTRY } from './organ-registry.ts';
import type { Level6Record, PlannedAction, RunRecord, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

export type CognitiveAssessment = {
  tenantId: string;
  runId: string;
  cognitiveLoad: number;
  driftScore: number;
  stabilityScore: number;
  safetyViolations: string[];
  escalationRecommended: boolean;
  decision: 'bounded' | 'review';
};

export class CognitiveControlPlane {
  static assess(run: RunRecord): CognitiveAssessment {
    const duplicateKinds = run.plan.filter((action, index) => run.plan.findIndex((candidate) => candidate.kind === action.kind && candidate.title === action.title) !== index);
    const highRisk = run.plan.filter((action) => ['high', 'critical'].includes(action.risk));
    const cognitiveLoad = Math.min(1, run.plan.length / Math.max(1, Number(process.env.MICROFIXD_MAX_PLAN_STEPS || 25)));
    const driftScore = Math.min(1, (duplicateKinds.length * 0.25) + (highRisk.length * 0.1));
    const stabilityScore = Number(Math.max(0, 1 - cognitiveLoad * 0.35 - driftScore).toFixed(3));
    const safetyViolations = [
      ...(duplicateKinds.length ? [`${duplicateKinds.length} duplicate workflow actions detected.`] : []),
      ...(highRisk.length ? [`${highRisk.length} protected actions require Paragon escalation.`] : []),
    ];
    return { tenantId: run.tenantId, runId: run.id, cognitiveLoad: Number(cognitiveLoad.toFixed(3)), driftScore: Number(driftScore.toFixed(3)), stabilityScore, safetyViolations, escalationRecommended: highRisk.length > 0 || driftScore > 0.35, decision: highRisk.length > 0 || driftScore > 0.35 ? 'review' : 'bounded' };
  }

  static async recordAssessment(store: RuntimeStore, run: RunRecord): Promise<Level6Record> {
    const assessment = this.assess(run);
    const timestamp = now();
    const record: Level6Record = {
      id: `cognitive-assessment:${run.id}`,
      type: 'cognitive_assessment',
      tenantId: run.tenantId,
      name: `Cognitive assessment for ${run.id}`,
      status: assessment.decision,
      payload: { ...assessment, oversight: 'Paragon Dissector validates every action independently; this record does not authorize action execution.' },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }

  static async recordMap(store: RuntimeStore, run: RunRecord): Promise<Level6Record> {
    const timestamp = now();
    const agents = await store.listLevel6Records('agent', run.tenantId);
    const memories = await store.recallMemory(run.agentId, '', 100, run.tenantId);
    const map: Level6Record = {
      id: `cognitive-map:${run.id}`,
      type: 'cognitive_map',
      tenantId: run.tenantId,
      name: `Cognitive map for ${run.id}`,
      status: 'current',
      payload: {
        runId: run.id,
        goal: run.goal,
        organs: ORGAN_REGISTRY.length,
        agents: agents.map((agent) => ({ id: agent.id, role: agent.payload.role, status: agent.status })),
        plan: run.plan.map((action: PlannedAction) => ({ id: action.id, kind: action.kind, risk: action.risk })),
        memoryReferences: memories.map((memory) => memory.id),
        relationships: ['tenant → run', 'run → plan', 'plan → Paragon decisions', 'run → agent handoffs', 'run → tenant-scoped memory'],
        boundary: 'Map contains operational relationships and durable record identifiers only; it does not claim private reasoning or unrecorded inference.',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(map);
    return map;
  }

  static evidenceFor(action: PlannedAction): Record<string, unknown> {
    return { actionId: action.id, cognitiveSafety: 'checked-by-bounded-plan-and-paragon', inference: 'deterministic constrained workflow', decisionLatencyStart: now(), traceId: randomUUID() };
  }
}

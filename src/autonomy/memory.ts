import { randomUUID } from 'node:crypto';
import type { Level6Record, MemoryRecord, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

export type MemoryPosture = {
  tenantId: string;
  recordCount: number;
  memoryLoad: number;
  driftScore: number;
  stabilityScore: number;
  errorRate: number;
  accessPattern: 'tenant-isolated-ranked-recall';
  safetyViolations: string[];
  escalationRecommended: boolean;
};

export class MemoryControlPlane {
  static assertTenant(memory: MemoryRecord, tenantId: string): void {
    if (memory.tenantId !== tenantId) throw new Error('Memory Routing Organ denied a cross-tenant memory write.');
    if (memory.content.length > 50_000) throw new Error('Memory Safety Hooks rejected an oversized memory record.');
  }

  static async append(store: RuntimeStore, memory: MemoryRecord): Promise<void> {
    this.assertTenant(memory, memory.tenantId);
    const versioned: MemoryRecord = {
      ...memory,
      metadata: {
        ...memory.metadata,
        memorySchemaVersion: '1.0.0',
        tenantIsolated: true,
        routing: 'Memory Routing Organ',
        oversight: 'Paragon Dissector records the enclosing run decision before execution.',
      },
    };
    await store.appendMemory(versioned);
    await this.recordPosture(store, memory.tenantId, memory.agentId);
  }

  static async recall(store: RuntimeStore, tenantId: string, agentId: string, query: string, limit: number): Promise<MemoryRecord[]> {
    const records = await store.recallMemory(agentId, query, Math.max(1, Math.min(limit, 100)), tenantId);
    await this.recordPosture(store, tenantId, agentId);
    return records;
  }

  static async posture(store: RuntimeStore, tenantId: string, agentId: string): Promise<MemoryPosture> {
    const records = await store.recallMemory(agentId, '', 500, tenantId);
    const tags = new Set(records.flatMap((memory) => memory.tags));
    const failures = records.filter((memory) => memory.score !== undefined && memory.score < 0).length;
    const load = Math.min(1, records.length / 500);
    const driftScore = records.length === 0 ? 0 : Number(Math.min(1, Math.max(0, (failures / records.length) * 0.5 + (records.length > 450 ? 0.25 : 0) + (tags.size < Math.min(3, records.length) ? 0.1 : 0))).toFixed(3));
    return {
      tenantId,
      recordCount: records.length,
      memoryLoad: Number(load.toFixed(3)),
      driftScore,
      stabilityScore: Number(Math.max(0, 1 - driftScore - load * 0.15).toFixed(3)),
      errorRate: records.length ? Number((failures / records.length).toFixed(3)) : 0,
      accessPattern: 'tenant-isolated-ranked-recall',
      safetyViolations: [],
      escalationRecommended: driftScore > 0.55,
    };
  }

  static async recordPosture(store: RuntimeStore, tenantId: string, agentId: string): Promise<Level6Record> {
    const posture = await this.posture(store, tenantId, agentId);
    const timestamp = now();
    const record: Level6Record = {
      id: `memory-posture:${tenantId}:${agentId}`,
      type: 'memory_assessment',
      tenantId,
      name: `Memory posture for ${agentId}`,
      status: posture.escalationRecommended ? 'review' : 'nominal',
      payload: { ...posture, telemetry: ['memory_load', 'memory_drift_score', 'memory_stability_score', 'memory_error_rate', 'memory_access_pattern'], oversight: 'Paragon Dissector governs the enclosing run; this posture cannot independently authorize a memory action.' },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }

  static async proposeCompression(store: RuntimeStore, tenantId: string, agentId: string): Promise<Level6Record> {
    const records = await store.recallMemory(agentId, '', 500, tenantId);
    const timestamp = now();
    const proposal: Level6Record = {
      id: `memory-compression:${tenantId}:${agentId}`,
      type: 'memory_assessment',
      tenantId,
      name: `Non-destructive compression proposal for ${agentId}`,
      status: 'proposal-only',
      payload: {
        sourceRecordCount: records.length,
        candidateIds: records.slice(-100).map((memory) => memory.id),
        strategy: 'Summarize redundant tenant-local experience records into a new reviewed memory record; do not delete or overwrite source records automatically.',
        safety: 'No compression or deletion executes without a bounded workflow, Paragon decision, and protected approval when material behavior or retention changes are involved.',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(proposal);
    return proposal;
  }

  static newExperience(input: Omit<MemoryRecord, 'id' | 'createdAt'>): MemoryRecord {
    return { ...input, id: randomUUID(), createdAt: now() };
  }
}

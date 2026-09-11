import type { Level6Record, RuntimeStore } from './types.ts';
import { ORGAN_REGISTRY, type OrganDefinition } from './organ-registry.ts';

const LAYER0_BOOT_ORDER = ['constitution-engine', 'doctrine-engine', 'identity-anchor', 'autonomy-regulator', 'paragon-dissector'];
const now = (): string => new Date().toISOString();

export type WiringEdge = { from: string; to: string; boundary: 'organ-kernel'; authority: 'Paragon Dissector'; version: '2.0.0' };
export type WiringValidation = { valid: boolean; organCount: number; edges: WiringEdge[]; missingDependencies: string[]; invalidLayer0Order: string[]; prohibitedDirectCalls: true };

const layer0Index = (id: string): number => {
  const index = LAYER0_BOOT_ORDER.indexOf(id);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
};

export class OrganLifecycleController {
  static bootPlan(): OrganDefinition[] {
    return [...ORGAN_REGISTRY].sort((left, right) => {
      const leftLayer0 = layer0Index(left.id);
      const rightLayer0 = layer0Index(right.id);
      if (leftLayer0 !== rightLayer0) return leftLayer0 - rightLayer0;
      if (left.layer !== right.layer) return left.layer - right.layer;
      if (left.familyNumber !== right.familyNumber) return left.familyNumber - right.familyNumber;
      return left.id.localeCompare(right.id);
    });
  }

  static wiring(): WiringEdge[] {
    return ORGAN_REGISTRY.flatMap((organ) => organ.metadata.dependencies.map((dependency) => ({
      from: dependency,
      to: organ.id,
      boundary: 'organ-kernel' as const,
      authority: 'Paragon Dissector' as const,
      version: '2.0.0',
    })));
  }

  static validate(): WiringValidation {
    const ids = new Set(ORGAN_REGISTRY.map((organ) => organ.id));
    const missingDependencies = ORGAN_REGISTRY.flatMap((organ) => organ.metadata.dependencies.filter((dependency) => !ids.has(dependency)).map((dependency) => `${organ.id} → ${dependency}`));
    const actualLayer0 = this.bootPlan().filter((organ) => LAYER0_BOOT_ORDER.includes(organ.id)).map((organ) => organ.id);
    const invalidLayer0Order = LAYER0_BOOT_ORDER.filter((id, index) => actualLayer0[index] !== id);
    return { valid: missingDependencies.length === 0 && invalidLayer0Order.length === 0, organCount: ORGAN_REGISTRY.length, edges: this.wiring(), missingDependencies, invalidLayer0Order, prohibitedDirectCalls: true };
  }

  static health(organ: OrganDefinition): Record<string, unknown> {
    return {
      organId: organ.id,
      health: organ.metadata.health,
      status: organ.metadata.status,
      telemetryEndpoint: organ.metadata.telemetryEndpoint,
      runtimeContext: organ.metadata.runtimeContext,
      repairEligibility: { sandboxOnly: true, replaceOrUpgrade: 'requires Paragon approval and Craig approval when protected' },
      capturedAt: now(),
    };
  }

  static async registerDurableState(store: RuntimeStore): Promise<WiringValidation> {
    const validation = this.validate();
    if (!validation.valid) throw new Error(`Organ Wiring Layer rejected the boot graph: ${[...validation.missingDependencies, ...validation.invalidLayer0Order].join('; ')}`);
    const timestamp = now();
    const records: Level6Record[] = [
      {
        id: 'wiring:level6:2.0.0', type: 'organ_wiring', tenantId: 'global', name: 'Level-6 declarative organ wiring graph', status: 'valid',
        payload: { ...validation, edgeCount: validation.edges.length, rule: 'All organ interactions use the Organ Kernel and recorded Paragon preflight; direct organ-to-organ execution is prohibited.' }, createdAt: timestamp, updatedAt: timestamp,
      },
      ...this.bootPlan().flatMap((organ, sequence): Level6Record[] => [
        { id: `boot:${organ.id}:2.0.0`, type: 'organ_boot', tenantId: 'global', name: organ.name, status: 'boot-ready', payload: { sequence, layer: organ.layer, dependencies: organ.metadata.dependencies, paragonHook: organ.metadata.paragonOversightHook, telemetryEndpoint: organ.metadata.telemetryEndpoint, version: organ.version }, createdAt: timestamp, updatedAt: timestamp },
        { id: `health:${organ.id}:2.0.0`, type: 'organ_health', tenantId: 'global', name: organ.name, status: organ.metadata.status, payload: this.health(organ), createdAt: timestamp, updatedAt: timestamp },
      ]),
    ];
    for (const record of records) await store.upsertLevel6Record(record);
    return validation;
  }
}

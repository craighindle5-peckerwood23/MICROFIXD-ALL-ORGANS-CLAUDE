// src/autonomy/meta-evolver.ts
//
// Scoped to what's real: outcomes are tracked by Level6Record type
// (evolution_assessment, repair_proposal) via
// SelfEvolvingControlPlane.recordsByType -- there is no finer-grained
// per-capability outcome tracking yet. MetaEvolver reasons at that same
// real granularity rather than fabricating a capability list that
// doesn't exist in tracked data.

import { SelfEvolvingControlPlane, type EvolutionProfile } from './self-evolving.ts';
import type { RuntimeStore } from './types.ts';

export interface EvolverRecommendation {
  recordType: string;
  successCount: number;
  reviewCount: number;
  successRate: number;
  recommendation: 'expansion-candidate' | 'retirement-candidate' | 'insufficient-data' | 'stable';
}

export class MetaEvolver {
  static recommendFromProfile(profile: EvolutionProfile): EvolverRecommendation[] {
    return Object.entries(profile.recordsByType).map(([recordType, stats]) => {
      const total = stats.success + stats.review;
      if (total < 3) return { recordType, successCount: stats.success, reviewCount: stats.review, successRate: 0, recommendation: 'insufficient-data' as const };
      const successRate = Number((stats.success / total).toFixed(3));
      const recommendation = successRate >= 0.8 ? 'expansion-candidate' as const : successRate < 0.4 ? 'retirement-candidate' as const : 'stable' as const;
      return { recordType, successCount: stats.success, reviewCount: stats.review, successRate, recommendation };
    });
  }

  static async recommend(store: RuntimeStore, tenantId: string): Promise<EvolverRecommendation[]> {
    const profile = await SelfEvolvingControlPlane.computeProfile(store, tenantId);
    return this.recommendFromProfile(profile);
  }
}

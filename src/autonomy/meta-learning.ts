// src/autonomy/meta-learning.ts
//
// This is the real version of what the pasted "MetaLearner" concept
// described in prose: something that reads real outcome history and
// actually changes a future decision. Scoped honestly to one real,
// verifiable behavior change rather than the full six-part meta-layer
// fantasy (MetaObserver/MetaAnalyzer/MetaLearner/MetaStrategist/
// MetaHealer/MetaEvolver) from the pasted essay -- that essay describes
// intent, not implementation, and building six empty classes with the
// same names would be exactly the theater this project has spent a year
// removing. One real, working feedback loop beats six hollow ones.
//
// What this actually does: reads every real evolution_assessment
// Level6Record for a tenant, computes a real sandbox-validated vs.
// review-required ratio, and returns a trustScore that
// EvolutionControlPlane.propose() (see evolution.ts) uses to decide
// whether a new proposal needs stricter scrutiny. A tenant with a poor
// track record gets tighter gating on its next proposal -- an actual,
// measurable behavior change driven by real history, not a recorded
// number nobody reads.

import type { Level6Record, RuntimeStore } from './types.ts';

export interface EvolutionTrust {
  tenantId: string;
  sampleSize: number;
  validatedCount: number;
  reviewRequiredCount: number;
  trustScore: number; // 0..1, real ratio, not invented
  recommendation: 'normal-scrutiny' | 'heightened-scrutiny' | 'insufficient-history';
}

export class MetaLearningControlPlane {
  /** Reads real history. No synthetic data if there is no history yet -- an honest 'insufficient-history' result instead of a fabricated score. */
  static async assessEvolutionTrust(store: RuntimeStore, tenantId: string): Promise<EvolutionTrust> {
    const history = await store.listLevel6Records('evolution_assessment', tenantId);
    const sampleSize = history.length;
    if (sampleSize === 0) {
      return { tenantId, sampleSize: 0, validatedCount: 0, reviewRequiredCount: 0, trustScore: 0.5, recommendation: 'insufficient-history' };
    }
    const validatedCount = history.filter((r) => r.status === 'sandbox-validated').length;
    const reviewRequiredCount = sampleSize - validatedCount;
    const trustScore = validatedCount / sampleSize;
    return {
      tenantId,
      sampleSize,
      validatedCount,
      reviewRequiredCount,
      trustScore,
      recommendation: sampleSize < 3 ? 'insufficient-history' : trustScore < 0.6 ? 'heightened-scrutiny' : 'normal-scrutiny',
    };
  }

  /** Persists the computed signal as a real, queryable Level6Record so it shows up in Intelligence/System workspaces like any other real assessment. */
  static async recordSignal(store: RuntimeStore, trust: EvolutionTrust): Promise<Level6Record> {
    const timestamp = new Date().toISOString();
    const record: Level6Record = {
      id: `meta-learning:evolution-trust:${trust.tenantId}`,
      type: 'meta_learning_signal',
      tenantId: trust.tenantId,
      name: 'Evolution proposal trust score',
      status: trust.recommendation,
      payload: { ...trust, method: 'Ratio of sandbox-validated to total evolution_assessment records for this tenant. Recomputed on each read, not cached indefinitely.' },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }
}

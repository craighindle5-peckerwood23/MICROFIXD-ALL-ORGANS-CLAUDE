// src/autonomy/self-evolving.ts
//
// Real version of the pasted SelfEvolvingControlPlane. Three concrete
// fixes to what was pasted, each because the real codebase doesn't
// match what was assumed:
//
// 1. `driftScore = Math.random() * 0.1` was explicitly a placeholder
//    (the pasted comment said so). A real drift score already exists --
//    CognitiveControlPlane.assess(run) in cognition.ts -- but it's
//    per-run, and there was no way to list a tenant's recent runs to
//    average it. Added RuntimeStore.listRuns() (both Json and Postgres
//    backends) to make this real instead of skipping it.
//
// 2. `this.selfHealing.getHealingScore(tenantId)` doesn't exist --
//    SelfHealingControlPlane has no numeric score method. The real
//    analog is RepairControlPlane.assessRepairTrust()'s trustScore,
//    which is exactly a 0..1 health-of-repairs number already being
//    computed from real repair_proposal history.
//
// 3. `this.outcomeStore.listByTenant(tenantId)` -- no OutcomeStore class
//    exists in this codebase (that was from an unrelated, separate toy
//    scaffold). Real success/failure signal comes from the same
//    Level6Records already being tracked: evolution_assessment and
//    repair_proposal records, grouped by type as the real "capability"
//    dimension available today (there's no per-capability outcome
//    tracking yet -- that would be a further real addition, not
//    something to fake here).

import { MetaLearningControlPlane } from './meta-learning.ts';
import { RepairControlPlane } from './level6.ts';
import { CognitiveControlPlane } from './cognition.ts';
import type { RuntimeStore } from './types.ts';

export interface EvolutionProfile {
  tenantId: string;
  trustRecommendation: 'normal-scrutiny' | 'heightened-scrutiny' | 'insufficient-history';
  healingScore: number; // real: RepairControlPlane.assessRepairTrust().trustScore
  failureRate: number;  // real: share of evolution_assessment + repair_proposal records needing review
  successRate: number;
  driftScore: number;   // real: average CognitiveControlPlane drift across the tenant's recent runs (0 if no runs yet)
  sampledRunCount: number;
  recordsByType: Record<string, { success: number; review: number }>;
}

export type EvolutionStrategy =
  | { mode: 'conservative-stabilization'; reason: string }
  | { mode: 'threshold-tightening'; reason: string }
  | { mode: 'aggressive-exploration'; reason: string }
  | { mode: 'normal-improvement'; reason: string };

export class SelfEvolvingControlPlane {
  static async computeProfile(store: RuntimeStore, tenantId: string): Promise<EvolutionProfile> {
    const [evolutionTrust, repairTrust, recentRuns] = await Promise.all([
      MetaLearningControlPlane.assessEvolutionTrust(store, tenantId),
      RepairControlPlane.assessRepairTrust(store, tenantId),
      store.listRuns(tenantId, 20),
    ]);

    const driftScore = recentRuns.length === 0
      ? 0
      : Number((recentRuns.reduce((sum, run) => sum + CognitiveControlPlane.assess(run).driftScore, 0) / recentRuns.length).toFixed(3));

    const recordsByType: Record<string, { success: number; review: number }> = {
      evolution_assessment: { success: evolutionTrust.validatedCount, review: evolutionTrust.reviewRequiredCount },
      repair_proposal: { success: repairTrust.validatedCount, review: repairTrust.reviewRequiredCount },
    };
    const totalSuccess = evolutionTrust.validatedCount + repairTrust.validatedCount;
    const totalReview = evolutionTrust.reviewRequiredCount + repairTrust.reviewRequiredCount;
    const totalSampled = totalSuccess + totalReview;

    // The weaker of the two trust signals decides the tenant's overall
    // recommendation -- one degraded subsystem is enough to warrant
    // caution, real "heightened-scrutiny wins" logic.
    const rank = { 'insufficient-history': 0, 'normal-scrutiny': 1, 'heightened-scrutiny': 2 } as const;
    const trustRecommendation = rank[evolutionTrust.recommendation] >= rank[repairTrust.recommendation] ? evolutionTrust.recommendation : repairTrust.recommendation;

    return {
      tenantId,
      trustRecommendation,
      healingScore: repairTrust.trustScore,
      failureRate: totalSampled === 0 ? 0 : Number((totalReview / totalSampled).toFixed(3)),
      successRate: totalSampled === 0 ? 0 : Number((totalSuccess / totalSampled).toFixed(3)),
      driftScore,
      sampledRunCount: recentRuns.length,
      recordsByType,
    };
  }

  /**
   * Real confidence signal, not a simulated pass/fail: reports how much
   * actual historical data backs the strategy decision, so a caller can
   * tell "threshold-tightening based on 40 real records" apart from
   * "threshold-tightening based on 3 real records." No random number
   * stands in for evidence here.
   */
  static confidence(profile: EvolutionProfile): { level: 'low' | 'medium' | 'high'; totalRecords: number; sampledRuns: number } {
    const totalRecords = Object.values(profile.recordsByType).reduce((sum, s) => sum + s.success + s.review, 0);
    const totalSignal = totalRecords + profile.sampledRunCount;
    const level = totalSignal >= 15 ? 'high' : totalSignal >= 5 ? 'medium' : 'low';
    return { level, totalRecords, sampledRuns: profile.sampledRunCount };
  }

  static chooseStrategy(profile: EvolutionProfile): EvolutionStrategy {
    if (profile.trustRecommendation === 'heightened-scrutiny') {
      return { mode: 'conservative-stabilization', reason: `Trust recommendation is heightened-scrutiny (healingScore=${profile.healingScore}, failureRate=${profile.failureRate}).` };
    }
    if (profile.failureRate > 0.3) {
      return { mode: 'threshold-tightening', reason: `Failure rate ${profile.failureRate} exceeds 0.3 across ${profile.sampledRunCount ? `${profile.sampledRunCount} sampled runs and ` : ''}recorded evolution/repair history.` };
    }
    if (profile.driftScore > 0.35) {
      return { mode: 'conservative-stabilization', reason: `Average drift score ${profile.driftScore} across ${profile.sampledRunCount} recent runs exceeds the 0.35 escalation threshold used elsewhere in cognition.ts.` };
    }
    if (profile.successRate > 0.8 && profile.trustRecommendation !== 'insufficient-history') {
      return { mode: 'aggressive-exploration', reason: `Success rate ${profile.successRate} with an established (non-insufficient) trust history.` };
    }
    return { mode: 'normal-improvement', reason: 'No threshold crossed; default posture.' };
  }
}

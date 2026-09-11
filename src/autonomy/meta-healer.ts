// src/autonomy/meta-healer.ts
//
// Deliberately recommends, does not act. self-healing.ts already
// documents this boundary explicitly ("prohibited: automatic restart,
// automatic replacement, automatic patch, automatic activation") --
// MetaHealer follows the same real rule rather than introducing a
// second, looser one. It reads real SafeModeControlPlane state (does
// not write it) and records a real Level6Record recommendation; a human
// still flips safe mode via the existing admin-gated route.

import { randomUUID } from 'node:crypto';
import { SafeModeControlPlane } from './level6.ts';
import type { DegradationAssessment } from './meta-analyzer.ts';
import type { Level6Record, RuntimeStore } from './types.ts';

export interface HealerRecommendation {
  tenantId: string;
  action: 'none' | 'recommend-safe-mode' | 'recommend-repair-review';
  reason: string;
  safeModeCurrentlyActive: boolean;
}

export class MetaHealer {
  static async recommend(store: RuntimeStore, assessment: DegradationAssessment): Promise<HealerRecommendation> {
    const current = await SafeModeControlPlane.get(store);
    const safeModeCurrentlyActive = Boolean((current?.payload as { enabled?: boolean } | undefined)?.enabled);

    let action: HealerRecommendation['action'] = 'none';
    let reason = 'No degradation signals crossed the recommendation threshold.';
    if (assessment.degraded && !safeModeCurrentlyActive) {
      action = 'recommend-safe-mode';
      reason = `anomalyScore ${assessment.anomalyScore} >= 0.4: ${assessment.signals.join(' ')}`;
    } else if (assessment.anomalyScore >= 0.2 && assessment.anomalyScore < 0.4) {
      action = 'recommend-repair-review';
      reason = `anomalyScore ${assessment.anomalyScore} is elevated but below the safe-mode threshold: ${assessment.signals.join(' ')}`;
    }

    const record: Level6Record = {
      id: `meta-healer:${assessment.tenantId}:${randomUUID()}`,
      type: 'health_assessment',
      tenantId: assessment.tenantId,
      name: 'MetaHealer recommendation',
      status: action,
      payload: { action, reason, anomalyScore: assessment.anomalyScore, signals: assessment.signals, authority: 'Recommendation only; safe mode and repairs remain human-gated via existing admin/operator routes.' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.upsertLevel6Record(record);

    return { tenantId: assessment.tenantId, action, reason, safeModeCurrentlyActive };
  }
}

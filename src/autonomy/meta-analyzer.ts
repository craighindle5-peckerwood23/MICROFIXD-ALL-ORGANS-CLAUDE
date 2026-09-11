// src/autonomy/meta-analyzer.ts
import { MetaObserver, type MetaObservation } from './meta-observer.ts';
import { SelfEvolvingControlPlane, type EvolutionProfile } from './self-evolving.ts';
import type { RuntimeStore } from './types.ts';

export interface DegradationAssessment {
  tenantId: string;
  observation: MetaObservation;
  profile: EvolutionProfile;
  signals: string[];
  anomalyScore: number; // 0..1, real: derived from real threshold crossings below, not invented
  degraded: boolean;
}

const HEAP_THRESHOLD = () => Number(process.env.MICROFIXD_WATCHDOG_HEAP_LIMIT_PRESSURE || 0.9);
const DRIFT_THRESHOLD = 0.35; // matches the threshold already used in cognition.ts's escalationRecommended

export class MetaAnalyzer {
  static async analyze(store: RuntimeStore, tenantId: string): Promise<DegradationAssessment> {
    const [observation, profile] = await Promise.all([
      MetaObserver.observe(store, tenantId),
      SelfEvolvingControlPlane.computeProfile(store, tenantId),
    ]);

    const signals: string[] = [];
    let score = 0;

    if (observation.heapPressure > HEAP_THRESHOLD()) { signals.push(`Heap pressure ${observation.heapPressure} exceeds threshold ${HEAP_THRESHOLD()}.`); score += 0.3; }
    if (!observation.wiringValid) { signals.push(`Organ wiring invalid: missing ${observation.missingDependencies.join(', ') || 'unspecified dependencies'}.`); score += 0.25; }
    if (!observation.storageDurable) { signals.push(`Storage backend is ${observation.storageBackend}, not durable.`); score += 0.15; }
    if (observation.recentCriticalFailures > 0) { signals.push(`${observation.recentCriticalFailures} critical health failures recorded.`); score += 0.2; }
    if (observation.emergencyStopActive) { signals.push('Emergency stop is active.'); score += 0.3; }
    if (profile.driftScore > DRIFT_THRESHOLD) { signals.push(`Average drift score ${profile.driftScore} exceeds ${DRIFT_THRESHOLD}.`); score += 0.2; }
    if (profile.trustRecommendation === 'heightened-scrutiny') { signals.push('Evolution/repair trust recommendation is heightened-scrutiny.'); score += 0.2; }

    const anomalyScore = Number(Math.min(1, score).toFixed(3));
    return { tenantId, observation, profile, signals, anomalyScore, degraded: anomalyScore >= 0.4 };
  }
}

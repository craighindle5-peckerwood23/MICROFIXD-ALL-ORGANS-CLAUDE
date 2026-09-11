// src/autonomy/meta-strategist.ts
import { MetaAnalyzer, type DegradationAssessment } from './meta-analyzer.ts';
import { SelfEvolvingControlPlane, type EvolutionStrategy } from './self-evolving.ts';
import type { RuntimeStore } from './types.ts';

export interface MetaDecision {
  tenantId: string;
  assessment: DegradationAssessment;
  strategy: EvolutionStrategy;
  systemMode: 'fully-autonomous' | 'human-in-loop' | 'degraded-safe';
}

export class MetaStrategist {
  static async decide(store: RuntimeStore, tenantId: string): Promise<MetaDecision> {
    const assessment = await MetaAnalyzer.analyze(store, tenantId);
    const strategy = SelfEvolvingControlPlane.chooseStrategy(assessment.profile);

    // Real, not aspirational: this system has no fully-autonomous mode
    // today -- every consequential action already routes through
    // Paragon/approval gates regardless of this label. 'human-in-loop'
    // is the accurate default; 'degraded-safe' reflects a real
    // anomalyScore crossing and is a label only -- it does not itself
    // flip MICROFIXD_EMERGENCY_STOP or safe mode. See MetaHealer for the
    // real, human-gated recommendation path.
    const systemMode: MetaDecision['systemMode'] = assessment.degraded ? 'degraded-safe' : 'human-in-loop';

    return { tenantId, assessment, strategy, systemMode };
  }
}

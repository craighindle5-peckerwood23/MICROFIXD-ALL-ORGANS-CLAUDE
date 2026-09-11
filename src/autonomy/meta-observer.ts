// src/autonomy/meta-observer.ts
import { getHeapStatistics } from 'node:v8';
import { OrganLifecycleController } from './organ-lifecycle.ts';
import type { RuntimeStore } from './types.ts';

export interface MetaObservation {
  tenantId: string;
  capturedAt: string;
  heapUsedBytes: number;
  heapLimitBytes: number;
  heapPressure: number;
  wiringValid: boolean;
  missingDependencies: string[];
  storageDurable: boolean;
  storageBackend: 'postgres' | 'json';
  recentCriticalFailures: number;
  recentDetectedFailures: number;
  emergencyStopActive: boolean;
}

export class MetaObserver {
  static async observe(store: RuntimeStore, tenantId: string): Promise<MetaObservation> {
    const heap = process.memoryUsage();
    const heapLimit = getHeapStatistics().heap_size_limit;
    const [wiring, storage, failures] = await Promise.all([
      Promise.resolve(OrganLifecycleController.validate()),
      store.health(),
      store.listLevel6Records('health_assessment', tenantId),
    ]);
    return {
      tenantId,
      capturedAt: new Date().toISOString(),
      heapUsedBytes: heap.heapUsed,
      heapLimitBytes: heapLimit,
      heapPressure: Number((heap.heapUsed / Math.max(heapLimit, 1)).toFixed(4)),
      wiringValid: wiring.valid,
      missingDependencies: wiring.missingDependencies,
      storageDurable: storage.durable,
      storageBackend: storage.storage,
      recentCriticalFailures: failures.filter((f) => f.status === 'critical').length,
      recentDetectedFailures: failures.filter((f) => f.status === 'detected').length,
      emergencyStopActive: process.env.MICROFIXD_EMERGENCY_STOP === 'true',
    };
  }
}

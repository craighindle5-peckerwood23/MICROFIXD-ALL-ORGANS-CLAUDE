import { randomUUID } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import { OrganLifecycleController } from './organ-lifecycle.ts';
import type { Level6Record, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

export class InfrastructureControlPlane {
  static posture(): Record<string, unknown> {
    const wiring = OrganLifecycleController.validate();
    const configuredPlugins = (() => { try { return JSON.parse(process.env.MICROFIXD_PLUGINS_JSON || '[]'); } catch { return []; } })();
    const runtime = process.env.RAILWAY_ENVIRONMENT ? 'railway' : process.env.K_SERVICE ? 'gcp-cloud-run' : process.env.CONTAINER_APP_NAME ? 'azure-container-apps' : 'local-or-codespaces';
    return {
      omniRouter: {
        exclusiveOutboundPath: true,
        boundary: 'All external API, plugin, web, cloud, device, compute, and source-control operations require an enabled Plugin Registry route via OmniRouter and a Paragon decision. No native fallback may issue a direct outbound call.',
        apiRecycling: 'Cache/reuse is available only inside OmniRouter; it does not authorize a route.',
      },
      pluginRegistry: { manifestCount: Array.isArray(configuredPlugins) ? configuredPlugins.length : 0, status: 'allowlist-only', tenantLayer: 'tenant rules can restrict but cannot relax global Plugin Registry policy' },
      runtimes: {
        current: runtime,
        local: 'active bounded Node runtime',
        cloud: 'portable Docker adapter across Railway, Codespaces, Azure, and GCP',
        remoteCompute: 'adapter-dormant until Plugin Registry, OmniRouter, Paragon, cost policy, and Craig approval are present',
        selector: 'local only for current bounded work; remote selection is never automatic',
      },
      devices: { supportedFamilies: ['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'automotive', 'embedded'], status: 'adapter-dormant', boundary: 'No device operation can occur without an approved Plugin Registry adapter routed through OmniRouter.' },
      compute: { cpuLogicalCores: cpus().length, memoryBytes: totalmem(), gpu: (process.env.NVIDIA_VISIBLE_DEVICES || '').trim() || 'none-detected', distributed: 'adapter-dormant', cluster: 'adapter-dormant' },
      health: { wiringValid: wiring.valid, organCount: wiring.organCount, wiringEdges: wiring.edges.length, recovery: 'Health detection can create sandbox repair proposals; restart, deployment, and rollback remain protected.' },
    };
  }

  static async record(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const timestamp = now();
    const record: Level6Record = {
      id: `infrastructure-posture:${tenantId}`,
      type: 'infrastructure_assessment',
      tenantId,
      name: 'Infrastructure posture',
      status: 'observed',
      payload: this.posture(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }

  static routingViolation(target: string): Level6Record {
    const timestamp = now();
    return { id: `routing-violation:${randomUUID()}`, type: 'infrastructure_assessment', tenantId: 'global', name: 'Direct outbound routing violation', status: 'blocked', payload: { target, requiredPath: 'OmniRouter → Plugin Registry → Paragon', action: 'No network request attempted.' }, createdAt: timestamp, updatedAt: timestamp };
  }
}

import { arch, cpus, freemem, platform, release, totalmem, type } from 'node:os';

type CloudProvider = 'railway' | 'codespaces' | 'azure' | 'gcp' | 'container' | 'unknown';

export type PhenotypeSnapshot = {
  organ: 'Phenotype Organ';
  host: { platform: string; release: string; architecture: string; type: string; cpuCount: number; cpuModel: string; memoryTotalMb: number; memoryFreeMb: number };
  cloud: { provider: CloudProvider; signals: string[]; serviceIdentity?: string };
  runtime: { node: string; pid: number; uptimeSeconds: number; containerized: boolean; resourceClass: 'constrained' | 'standard' | 'expanded' };
  adaptation: { concurrencyBudget: number; memoryPressure: number; guidance: string[] };
  timestamp: string;
};

export class PhenotypeOrgan {
  static scan(): PhenotypeSnapshot {
    const hostCpus = cpus();
    const memoryTotalMb = Math.floor(totalmem() / 1024 / 1024);
    const memoryFreeMb = Math.floor(freemem() / 1024 / 1024);
    const memoryPressure = Number((1 - memoryFreeMb / Math.max(memoryTotalMb, 1)).toFixed(3));
    const cloud = this.detectCloud();
    const constrained = memoryTotalMb <= 1_024 || hostCpus.length <= 1;
    const expanded = memoryTotalMb >= 8_192 && hostCpus.length >= 4;
    const resourceClass = constrained ? 'constrained' : expanded ? 'expanded' : 'standard';
    const guidance = [
      `Use a concurrency budget of ${Math.max(1, Math.min(hostCpus.length, constrained ? 1 : 4))}.`,
      memoryPressure >= 0.85 ? 'Memory pressure is elevated; defer nonessential candidate generation.' : 'Memory pressure is within the configured observation range.',
      cloud.provider === 'unknown' ? 'No recognized cloud-provider signal is present; use portable defaults.' : `Portable runtime profile recognized: ${cloud.provider}.`,
    ];

    return {
      organ: 'Phenotype Organ',
      host: { platform: platform(), release: release(), architecture: arch(), type: type(), cpuCount: hostCpus.length, cpuModel: hostCpus[0]?.model || 'unknown', memoryTotalMb, memoryFreeMb },
      cloud,
      runtime: { node: process.version, pid: process.pid, uptimeSeconds: Math.floor(process.uptime()), containerized: Boolean(process.env.KUBERNETES_SERVICE_HOST || process.env.RAILWAY_ENVIRONMENT || process.env.CONTAINERIZED), resourceClass },
      adaptation: { concurrencyBudget: Math.max(1, Math.min(hostCpus.length, constrained ? 1 : 4)), memoryPressure, guidance },
      timestamp: new Date().toISOString(),
    };
  }

  private static detectCloud(): PhenotypeSnapshot['cloud'] {
    const signals: string[] = [];
    let provider: CloudProvider = 'unknown';
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) { provider = 'railway'; signals.push('RAILWAY_ENVIRONMENT or RAILWAY_PROJECT_ID'); }
    else if (process.env.CODESPACES || process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) { provider = 'codespaces'; signals.push('CODESPACES or GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN'); }
    else if (process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_INSTANCE_ID) { provider = 'azure'; signals.push('WEBSITE_SITE_NAME or WEBSITE_INSTANCE_ID'); }
    else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) { provider = 'gcp'; signals.push('K_SERVICE or GOOGLE_CLOUD_PROJECT'); }
    else if (process.env.KUBERNETES_SERVICE_HOST || process.env.CONTAINERIZED) { provider = 'container'; signals.push('KUBERNETES_SERVICE_HOST or CONTAINERIZED'); }
    return { provider, signals, serviceIdentity: process.env.RAILWAY_SERVICE_NAME || process.env.K_SERVICE || process.env.WEBSITE_SITE_NAME || process.env.GITHUB_REPOSITORY };
  }
}

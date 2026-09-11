import type { TelemetryEvent } from './types.ts';

const sanitize = (value: string | number | boolean | undefined): string | number | boolean | undefined => {
  if (typeof value !== 'string') return value;
  return value.replace(/(?:api[_-]?key|token|password|secret)=?[^\s,;]+/gi, '$1=[REDACTED]').slice(0, 1000);
};

const metricKey = (name: string, labels: Record<string, string> = {}): string => `${name}{${Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`).join(',')}}`;

export class Telemetry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly events: TelemetryEvent[] = [];

  event(name: string, fields: TelemetryEvent['fields'] = {}, runId?: string): void {
    const event: TelemetryEvent = {
      name,
      timestamp: new Date().toISOString(),
      runId,
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sanitize(value)])),
    };
    this.events.push(event);
    if (this.events.length > 500) this.events.shift();
    console.log(JSON.stringify({ level: 'info', organ: 'Telemetry', ...event }));
  }

  increment(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + amount);
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.gauges.set(metricKey(name, labels), value);
  }

  recent(limit = 50): TelemetryEvent[] {
    return this.events.slice(-limit);
  }

  metrics(): string {
    const counters = Array.from(this.counters.entries()).map(([key, value]) => `microfixd_${key} ${value}`);
    const gauges = Array.from(this.gauges.entries()).map(([key, value]) => `microfixd_${key} ${value}`);
    return [
      '# HELP microfixd_runtime_up Runtime process health indicator',
      '# TYPE microfixd_runtime_up gauge',
      'microfixd_runtime_up 1',
      ...counters,
      ...gauges,
      '',
    ].join('\n');
  }
}

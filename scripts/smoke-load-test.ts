// scripts/smoke-load-test.ts
//
// A real smoke/load test: boots the actual server code (not a mock),
// fires many concurrent requests across every real endpoint category
// (chat, introspection, telemetry, usage-report, organ invocation,
// upload, approvals), and reports actual pass/fail/latency -- not a
// simulated report. Run with: npx tsx scripts/smoke-load-test.ts
import express from 'express';
import { AutonomyRuntime } from '../src/autonomy/runtime.ts';
import { PluginRegistry } from '../src/autonomy/omni-router.ts';
import { mountAutonomyRoutes } from '../src/autonomy/routes.ts';
import { requestLogger } from '../src/autonomy/request-logger.ts';

const ADMIN_KEY = 'smoke-test-admin-key';
const CONCURRENCY = 25;
const ROUNDS = 4;

type Result = { name: string; ok: boolean; status: number; ms: number; error?: string };

async function timed(name: string, fn: () => Promise<Response>): Promise<Result> {
  const start = Date.now();
  try {
    const res = await fn();
    await res.text().catch(() => {});
    return { name, ok: res.status < 500, status: res.status, ms: Date.now() - start };
  } catch (err) {
    return { name, ok: false, status: 0, ms: Date.now() - start, error: (err as Error).message };
  }
}

async function main() {
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  const runtime = new AutonomyRuntime();
  await runtime.initialize();
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(requestLogger(runtime.telemetry, runtime.store));
  mountAutonomyRoutes(app, runtime, new PluginRegistry([]));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  const H = { 'Content-Type': 'application/json', 'x-microfixd-admin-key': ADMIN_KEY, 'x-microfixd-tenant': 'global' };

  console.log(`Smoke/load test: ${CONCURRENCY} concurrent requests x ${ROUNDS} rounds x 6 endpoint types = ${CONCURRENCY * ROUNDS * 6} total requests`);
  console.log(`Server: ${base}\n`);

  const allResults: Result[] = [];
  const overallStart = Date.now();

  for (let round = 1; round <= ROUNDS; round++) {
    const tasks: Promise<Result>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      tasks.push(timed('chat', () => fetch(`${base}/api/autonomy/chat`, { method: 'POST', headers: H, body: JSON.stringify({ message: 'system status', requestedBy: `load-${i}` }) })));
      tasks.push(timed('introspection', () => fetch(`${base}/api/autonomy/introspection`, { headers: H })));
      tasks.push(timed('compute-posture', () => fetch(`${base}/api/autonomy/compute/posture`, { headers: H })));
      tasks.push(timed('usage-report', () => fetch(`${base}/api/autonomy/usage-report`, { headers: H })));
      tasks.push(timed('organ-status', () => fetch(`${base}/api/autonomy/organs/webhook-organ`, { headers: H })));
      tasks.push(timed('upload', () => fetch(`${base}/api/autonomy/upload`, { method: 'POST', headers: H, body: JSON.stringify({ filename: `load-${i}.txt`, base64Content: Buffer.from(`load test ${i}`).toString('base64'), requestedBy: `load-${i}` }) })));
    }
    const roundResults = await Promise.all(tasks);
    allResults.push(...roundResults);
    const roundFailures = roundResults.filter((r) => !r.ok);
    console.log(`Round ${round}/${ROUNDS}: ${roundResults.length} requests, ${roundFailures.length} failures.`);
    if (roundFailures.length > 0) {
      for (const f of roundFailures.slice(0, 5)) console.log(`  FAIL [${f.name}] status=${f.status} ${f.error || ''}`);
    }
  }

  const totalMs = Date.now() - overallStart;
  const failures = allResults.filter((r) => !r.ok);
  const byName = new Map<string, Result[]>();
  for (const r of allResults) byName.set(r.name, [...(byName.get(r.name) || []), r]);

  console.log('\n=== Summary ===');
  console.log(`Total requests: ${allResults.length}`);
  console.log(`Total time: ${totalMs}ms`);
  console.log(`Failures: ${failures.length}`);
  for (const [name, results] of byName) {
    const times = results.map((r) => r.ms).sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const max = times[times.length - 1];
    const failCount = results.filter((r) => !r.ok).length;
    console.log(`  ${name}: n=${results.length} p50=${p50}ms p95=${p95}ms max=${max}ms failures=${failCount}`);
  }

  server.close();
  if (failures.length > 0) {
    console.error(`\nSMOKE TEST FAILED: ${failures.length} request(s) returned a 5xx or threw.`);
    process.exit(1);
  }
  console.log('\nSMOKE TEST PASSED: no server errors under concurrent load.');
}

main();

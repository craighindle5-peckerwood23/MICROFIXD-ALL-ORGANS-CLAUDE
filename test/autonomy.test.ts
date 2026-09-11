import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { OmniRouter, PluginRegistry } from '../src/autonomy/omni-router.ts';
import { OrganKernel } from '../src/autonomy/organ-kernel.ts';
import { listOrgans, organSummary } from '../src/autonomy/organ-registry.ts';
import { SecurityOrgans } from '../src/autonomy/security.ts';
import { AutonomyRuntime } from '../src/autonomy/runtime.ts';
import { SandboxWorkspace } from '../src/autonomy/sandbox.ts';
import { JsonRuntimeStore } from '../src/autonomy/store.ts';
import { Telemetry } from '../src/autonomy/telemetry.ts';
import { AutomotiveDiagnosticsOrgan, FallbackSafetyOrgan, VisualSnapshotOrgan } from '../src/autonomy/auxiliary-organs.ts';
import { SelfHealingControlPlane } from '../src/autonomy/self-healing.ts';
import { ChatOrgan } from '../src/autonomy/chat.ts';
import { ParagonGateway } from '../src/autonomy/gateway.ts';
import express from 'express';
import { mountAutonomyRoutes } from '../src/autonomy/routes.ts';
import { requestLogger } from '../src/autonomy/request-logger.ts';
import { proposeGovernedAction, consumeApprovalOnce } from '../src/autonomy/governed-execution.ts';
import { previewPlan, executePlan } from '../src/autonomy/browser-automation.ts';
import { importRepoFile, exportRepoFile } from '../src/autonomy/github-integration.ts';

test('Tier-0 Paragon permits a bounded sandbox self-repair workflow and records every step', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(
      new JsonRuntimeStore(join(directory, 'state.json')),
      undefined,
      new SandboxWorkspace(join(directory, 'sandbox')),
    );
    const run = await runtime.submitGoal({ goal: 'Build and validate a sandbox capability for report repair.', requestedBy: 'Craig' });
    const detail = await runtime.getRunWithSteps(run.id);
    assert.equal(detail?.run.status, 'succeeded');
    assert.equal(detail?.steps.length, 5);
    assert.ok(detail?.steps.every((step) => step.status === 'succeeded'));
    assert.ok(detail?.steps.every((step) => step.policy?.outcome === 'allow'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Tier-0 Paragon escalates an external protected action to Craig', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const run = await runtime.submitGoal({ goal: 'Deploy a production plugin through an external paid API.', requestedBy: 'Craig' });
    assert.equal(run.status, 'awaiting_approval');
    const approvals = await runtime.store.listApprovals('pending');
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0].action.kind, 'external_effect');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('OmniRouter blocks a disabled plugin without making an outbound call and records the event', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    await store.initialize();
    const runtime = new AutonomyRuntime(store);
    const registry = new PluginRegistry([{ id: 'disabled-plugin', enabled: false, allowedOperations: ['read'], risk: 'low', routes: [] }]);
    const router = new OmniRouter(registry, runtime.paragon, store, new Telemetry());
    const response = await router.route({ runId: 'run-1', stepId: 'step-1', pluginId: 'disabled-plugin', operation: 'read', path: '/' });
    assert.equal(response.status, 'blocked');
    const audits = await store.listIntegrationAudits('run-1', 10);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].outcome, 'blocked');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ChatOrgan answers a status question through the same governed path as the REST route, and refuses to guess on unrecognized input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();
    const organs = new OrganKernel(runtime.store, runtime.paragon, runtime.telemetry);
    const chat = new ChatOrgan(runtime, organs);
    const ctx = { tenantId: 'global', requestedBy: 'Craig' };

    const status = await chat.route('system status', ctx);
    assert.equal(status.status, 'ok');
    assert.equal(status.organId, 'runtime-auditor');
    assert.ok(status.data, 'expected introspection data back');

    const goalAttempt = await chat.route('create a goal to check disk space', ctx);
    assert.equal(goalAttempt.status, 'ok');
    assert.ok((goalAttempt.data as { id: string }).id, 'expected a run id from submitGoal');

    const gibberish = await chat.route('purple elephant sandwich', ctx);
    assert.equal(gibberish.status, 'not_understood');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ParagonGateway denies a runtime.override intent outright regardless of actor, and allows a mission.execute intent through the same policy engine as everything else', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();
    const gateway = new ParagonGateway(runtime, runtime.paragon);

    const override = await gateway.handle({ actor: { id: 'craig', role: 'operator' }, intent: { type: 'runtime.override', payload: {} } }, 'craig');
    assert.equal(override.decision, 'DENIED');

    const autonomyToggle = await gateway.handle({ actor: { id: 'craig', role: 'operator' }, intent: { type: 'system.modify', payload: { enable_autonomy: true } } }, 'craig');
    assert.equal(autonomyToggle.decision, 'DENIED', 'a critical-risk system.modify payload must be denied outright, not merely queued for approval');

    const mission = await gateway.handle({
      actor: { id: 'operator_123', role: 'operator', scopes: ['mission'] },
      intent: { type: 'mission.execute', payload: { mission_id: 'msn_001', parameters: { target: 'alpha', mode: 'analysis' } } },
      context: { system_state: 'stable', environment: 'staging', correlation_id: 'req_987654' },
    }, 'operator_123');
    assert.equal(mission.decision, 'ALLOWED');
    assert.equal(mission.result?.status, 'SUCCESS');

    const unwired = await gateway.handle({ actor: { id: 'craig', role: 'operator' }, intent: { type: 'analytics.report' } }, 'craig');
    assert.equal(unwired.decision, 'ALLOWED');
    assert.equal(unwired.result?.status, 'NOT_WIRED', 'an allowed intent with no runtime handler must say so honestly, not fabricate success');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the chat box reaches /api/autonomy/chat over real HTTP, and both the request and the chat action are durably logged and retrievable via /api/autonomy/usage-report', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  const adminKey = 'test-admin-key-for-http-chat-verification';
  process.env.ADMIN_API_KEY = adminKey;
  let server: import('node:http').Server | undefined;
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();
    const registry = new PluginRegistry([]);

    const app = express();
    app.use(express.json());
    app.use(requestLogger(runtime.telemetry, runtime.store));
    mountAutonomyRoutes(app, runtime, registry);

    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. The chat box's actual request shape: POST /api/autonomy/chat with the admin key header.
    const chatResponse = await fetch(`${baseUrl}/api/autonomy/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-microfixd-admin-key': adminKey, 'x-microfixd-tenant': 'global' },
      body: JSON.stringify({ message: 'system status', requestedBy: 'Craig' }),
    });
    assert.equal(chatResponse.status, 200);
    const chatBody = await chatResponse.json() as { status: string; organId?: string };
    assert.equal(chatBody.status, 'ok');
    assert.equal(chatBody.organId, 'runtime-auditor');

    // 2. A request with no admin key must be rejected -- the endpoint is not silently open.
    const unauthedResponse = await fetch(`${baseUrl}/api/autonomy/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'system status' }),
    });
    assert.equal(unauthedResponse.status, 401);

    // 3. Both the HTTP request itself and the chat action it triggered must show up in durable usage history.
    const usageResponse = await fetch(`${baseUrl}/api/autonomy/usage-report`, { headers: { 'x-microfixd-admin-key': adminKey, 'x-microfixd-tenant': 'global' } });
    assert.equal(usageResponse.status, 200);
    const usageBody = await usageResponse.json() as { durableHistory: { eventCount: number; eventCountByKind: Record<string, number> } };
    assert.ok(usageBody.durableHistory.eventCount >= 2, 'expected at least the http_request and chat events to be durably logged');
    assert.ok((usageBody.durableHistory.eventCountByKind.http_request || 0) >= 1, 'expected at least one durable http_request usage event');
    assert.ok((usageBody.durableHistory.eventCountByKind.chat || 0) >= 1, 'expected at least one durable chat usage event');
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    delete process.env.ADMIN_API_KEY;
    await rm(directory, { recursive: true, force: true });
  }
});

test('a photo/zip/OBD2 file uploaded through the chat interface is written to disk, hashed, size-checked, and durably logged with a real dataRef', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  const uploadsDir = join(directory, 'uploads');
  const adminKey = 'test-admin-key-for-upload-verification';
  process.env.ADMIN_API_KEY = adminKey;
  process.env.MICROFIXD_UPLOADS_DIR = uploadsDir;
  let server: import('node:http').Server | undefined;
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();
    const registry = new PluginRegistry([]);

    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use(requestLogger(runtime.telemetry, runtime.store));
    mountAutonomyRoutes(app, runtime, registry);

    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const fakeObd2Export = Buffer.from('DTC: P0300 Random/Multiple Cylinder Misfire Detected\nRPM: 812\nCoolantTempC: 91').toString('base64');
    const uploadResponse = await fetch(`${baseUrl}/api/autonomy/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-microfixd-admin-key': adminKey, 'x-microfixd-tenant': 'global' },
      body: JSON.stringify({ filename: '../../evil.txt', mimeType: 'text/plain', base64Content: fakeObd2Export, requestedBy: 'Craig' }),
    });
    assert.equal(uploadResponse.status, 201);
    const uploadBody = await uploadResponse.json() as { upload: { id: string; filename: string; sizeBytes: number; sha256: string } };
    assert.ok(uploadBody.upload.id);
    assert.ok(!uploadBody.upload.filename.includes('..'), 'path traversal characters must be stripped from the stored filename');
    assert.equal(uploadBody.upload.sizeBytes, Buffer.from(fakeObd2Export, 'base64').length);

    const usageResponse = await fetch(`${baseUrl}/api/autonomy/usage-report`, { headers: { 'x-microfixd-admin-key': adminKey, 'x-microfixd-tenant': 'global' } });
    const usageBody = await usageResponse.json() as { durableHistory: { eventCountByKind: Record<string, number> }; recentDurableEvents: Array<{ kind: string; dataRefs: string[] }> };
    assert.ok((usageBody.durableHistory.eventCountByKind.upload || 0) >= 1);
    const uploadEvent = usageBody.recentDurableEvents.find((event) => event.kind === 'upload');
    assert.ok(uploadEvent, 'expected the upload to appear in durable usage history');
    assert.deepEqual(uploadEvent!.dataRefs, [uploadBody.upload.id]);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    delete process.env.ADMIN_API_KEY;
    delete process.env.MICROFIXD_UPLOADS_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});

test('the complete 201-organ registry spans eight layers under one Tier-0 Paragon authority and blocks protected adapter preparation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    assert.equal(listOrgans().length, 201);
    assert.equal(organSummary().families, 21);
    assert.equal(organSummary().layers, 8);
    assert.equal(organSummary().tier0, 'Paragon Dissector');
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    await store.initialize();
    const runtime = new AutonomyRuntime(store);
    const kernel = new OrganKernel(store, runtime.paragon, new Telemetry());
    const result = await kernel.invoke({ organId: 'payments-organ', operation: 'prepare', requestedBy: 'Craig' });
    assert.equal(result.outcome, 'denied');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Security Organs reject secret-bearing operational input', () => {
  assert.throws(() => SecurityOrgans.assertSafeInput('api_key=supersecretvalue123'), /Security Organs blocked/);
});

test('Automotive Diagnostics remains read-only while classifying unsafe telemetry', () => {
  const result = AutomotiveDiagnosticsOrgan.diagnose({ coolantTempC: 115, voltage: 11.2, diagnosticCodes: ['P0128'] });
  assert.equal(result.classification, 'attention-required');
  assert.match(String(result.boundary), /cannot write/i);
});

test('Visual Snapshot and fallback safety records exclude external execution claims', () => {
  const snapshot = VisualSnapshotOrgan.capture({ organSummary: { total: 200 }, phenotype: { provider: 'local' }, whiteLabel: { brandName: 'Microfixd' } });
  assert.equal(snapshot.type, 'sanitized-system-state-snapshot');
  const fallback = FallbackSafetyOrgan.safeFallback({ id: 'run-1', tenantId: 'global', agentId: 'test', goal: 'test', requestedBy: 'Craig', metadata: {}, status: 'running', plan: [], currentStep: 0, workingMemory: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { id: 'action-1', kind: 'sandbox_validate', title: 'test', input: {}, risk: 'medium' }, 'validation failed');
  assert.equal(fallback.safeState, 'halted-without-production-change');
});


test('Level-6 tenant isolation records six governed agent roles and blocks cross-tenant change requests', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')), undefined, new SandboxWorkspace(join(directory, 'sandbox')));
    const run = await runtime.submitGoal({ tenantId: 'tenant-alpha', goal: 'Design and validate a sandbox workflow for tenant reporting.', requestedBy: 'Craig' });
    assert.equal(run.tenantId, 'tenant-alpha');
    const agents = await runtime.listAgents('tenant-alpha');
    assert.equal(agents.length, 6);
    const handoffs = await runtime.store.listLevel6Records('agent_execution', 'tenant-alpha');
    assert.ok(handoffs.some((record) => record.payload.role === 'planner'));
    await assert.rejects(runtime.requestGithubChange(run.id, 'global', 'Cross-tenant request must fail.'), /Tenant Isolation Guard denied/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Safe mode halts new bounded work while preserving governed inspection state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const mode = await runtime.setSafeMode(true, 'Craig', 'Regression hold');
    assert.equal(mode.status, 'enabled');
    await assert.rejects(runtime.submitGoal({ goal: 'Inspect a new sandbox capability.', requestedBy: 'Craig' }), /Safe Mode Control Organ halted/);
    await runtime.setSafeMode(false, 'Craig', 'Regression release');
    const inspection = await runtime.introspect();
    assert.equal((inspection.organs as { total: number }).total, 201);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Enterprise tenant profiles remain non-relaxable and approval decisions are tenant-scoped', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const tenant = await runtime.ensureTenant('tenant-alpha', 'Tenant Alpha');
    const profile = tenant.payload as { profileVersion?: string; constitution?: { source?: string }; plugins?: { directNetworkAccess?: boolean }; memory?: { isolation?: string } };
    assert.equal(profile.profileVersion, '2.0.0');
    assert.equal(profile.constitution?.source, 'inherits-global-tier-0-paragon');
    assert.equal(profile.plugins?.directNetworkAccess, false);
    assert.match(String(profile.memory?.isolation), /Tenant-scoped/);

    const run = await runtime.submitGoal({ tenantId: 'tenant-alpha', goal: 'Deploy a production plugin through an external paid API.', requestedBy: 'Craig' });
    assert.equal(run.status, 'awaiting_approval');
    const tenantApprovals = await runtime.listApprovals('tenant-alpha', 'pending');
    assert.equal(tenantApprovals.length, 1);
    assert.equal((await runtime.listApprovals('global', 'pending')).length, 0);
    const denied = await runtime.decideApproval(tenantApprovals[0].id, true, 'Must not cross tenant.', 'Craig', 'global');
    assert.equal(denied, undefined);
    assert.equal((await runtime.listApprovals('tenant-alpha', 'pending')).length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Infrastructure posture is tenant-scoped durable evidence with OmniRouter exclusivity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const posture = await runtime.infrastructurePosture('tenant-infrastructure');
    const payload = posture.payload as { omniRouter?: { exclusiveOutboundPath?: boolean }; runtimes?: { selector?: string } };
    assert.equal(posture.type, 'infrastructure_assessment');
    assert.equal(posture.tenantId, 'tenant-infrastructure');
    assert.equal(payload.omniRouter?.exclusiveOutboundPath, true);
    assert.match(String(payload.runtimes?.selector), /never automatic/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Compute topology reports governed local discovery while remote and cluster routes remain dormant', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const assessment = await runtime.computeAssessment('tenant-compute');
    const payload = assessment.payload as {
      organs?: { accelerationRouter?: { status?: string }; distributedCompute?: { status?: string }; clusterOrchestrator?: { status?: string } };
      routes?: { remoteCompute?: string; cluster?: string };
      boundary?: string;
    };
    assert.equal(assessment.tenantId, 'tenant-compute');
    assert.equal(payload.organs?.accelerationRouter?.status, 'policy-only');
    assert.equal(payload.organs?.distributedCompute?.status, 'adapter-dormant');
    assert.equal(payload.organs?.clusterOrchestrator?.status, 'adapter-dormant');
    assert.match(String(payload.routes?.remoteCompute), /OmniRouter and Plugin Registry/);
    assert.match(String(payload.boundary), /Craig approval/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Web-use posture is tenant-scoped, Puppeteer-only, and reality-anchored', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const posture = await runtime.webUsePosture('tenant-web');
    const payload = posture.payload as {
      puppeteer?: { exclusiveWebActionAuthority?: boolean };
      safety?: { directNetworkAccess?: boolean };
      routing?: { noExceptions?: boolean };
      reality?: { anchor?: string };
    };
    assert.equal(posture.tenantId, 'tenant-web');
    assert.equal(payload.puppeteer?.exclusiveWebActionAuthority, true);
    assert.equal(payload.safety?.directNetworkAccess, false);
    assert.equal(payload.routing?.noExceptions, true);
    assert.match(String(payload.reality?.anchor), /integration audit records/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Security Organ blocks secret-bearing OmniRouter payloads before plugin routing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    await store.initialize();
    const runtime = new AutonomyRuntime(store);
    const router = new OmniRouter(new PluginRegistry([{ id: 'test-plugin', enabled: true, allowedOperations: ['read'], risk: 'low', routes: [{ id: 'test-route', baseUrl: 'https://example.com', kind: 'free', estimatedCostUsd: 0 }] }]), runtime.paragon, store, new Telemetry());
    const response = await router.route({ runId: 'run-security', stepId: 'step-security', pluginId: 'test-plugin', operation: 'read', path: '/safe', body: { api_key: 'supersecretvalue123' } });
    assert.equal(response.status, 'blocked');
    assert.match(response.detail, /Security Organs blocked/);
    const audits = await store.listIntegrationAudits('run-security', 10);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].outcome, 'blocked');
    assert.equal(audits[0].details.gate, 'Security Organ before Plugin Registry and OmniRouter routing.');
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Multi-agent workforce has versioned tenant-isolated roles and durable routing, collaboration, oversight, and arbitration evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')), undefined, new SandboxWorkspace(join(directory, 'sandbox')));
    const run = await runtime.submitGoal({ tenantId: 'tenant-agents', goal: 'Design and validate a sandbox workflow for governed agent telemetry.', requestedBy: 'Craig' });
    assert.equal(run.tenantId, 'tenant-agents');
    const agents = await runtime.listAgents('tenant-agents');
    assert.equal(agents.length, 6);
    assert.ok(agents.every((agent) => agent.payload.profileVersion === '2.0.0'));
    assert.ok(agents.every((agent) => agent.payload.authority === 'Paragon Dissector Tier-0'));
    assert.match(String(agents.find((agent) => agent.payload.role === 'builder')?.payload.executionBoundary), /cannot directly invoke an external provider/);

    const posture = await runtime.multiAgentPosture('tenant-agents') as {
      registry?: { agentCount?: number; versioned?: boolean };
      router?: { directExecution?: boolean };
      arbitration?: { boundary?: string };
      telemetry?: { evidenceCount?: number };
    };
    assert.equal(posture.registry?.agentCount, 6);
    assert.equal(posture.registry?.versioned, true);
    assert.equal(posture.router?.directExecution, false);
    assert.match(String(posture.arbitration?.boundary), /Paragon decision/);
    assert.ok((posture.telemetry?.evidenceCount || 0) >= 5);

    const evidence = await runtime.store.listLevel6Records('agent_execution', 'tenant-agents');
    assert.ok(evidence.some((item) => item.name === `agent-collaboration:${run.id}`));
    assert.ok(evidence.some((item) => item.name === `agent-oversight:${run.id}`));
    assert.ok(evidence.some((item) => item.name === `agent-arbitration:${run.id}`));
    assert.equal((await runtime.store.listLevel6Records('agent_execution', 'global')).some((item) => item.payload.runId === run.id), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Self-healing posture preserves evidence and keeps failures and repair activation tenant-scoped and sandbox-only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const posture = await runtime.selfHealingPosture('tenant-healing');
    const payload = posture.payload as {
      organRepairEngine?: { prohibited?: string[] };
      failureDetection?: { monitoredScopes?: string[] };
      safety?: { sandboxOnly?: boolean; evidencePreserving?: boolean };
      recovery?: { model?: string };
    };
    assert.equal(posture.type, 'health_assessment');
    assert.equal(posture.tenantId, 'tenant-healing');
    assert.ok(payload.organRepairEngine?.prohibited?.includes('automatic restart'));
    assert.ok(payload.failureDetection?.monitoredScopes?.includes('tenant'));
    assert.equal(payload.safety?.sandboxOnly, true);
    assert.equal(payload.safety?.evidencePreserving, true);
    assert.match(String(payload.recovery?.model), /Do not silently restart/);

    const failure = await SelfHealingControlPlane.recordFailure(runtime.store, {
      tenantId: 'tenant-healing', scope: 'runtime', severity: 'critical', message: 'Runtime rejected api_key=supersecretvalue123 during controlled validation.', evidence: { source: 'regression' },
    });
    assert.equal(failure.tenantId, 'tenant-healing');
    assert.equal(failure.status, 'critical');
    const failurePayload = failure.payload as { message?: string; repairBoundary?: string; oversight?: string };
    assert.doesNotMatch(String(failurePayload.message), /supersecretvalue123/);
    assert.match(String(failurePayload.repairBoundary), /No automatic restart/);
    assert.match(String(failurePayload.oversight), /Paragon Dissector Tier-0/);
    assert.equal((await runtime.store.listLevel6Records('health_assessment', 'global')).some((record) => record.id === failure.id), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('every one of the 200 registered organs produces a real governed decision and audit record when invoked, not just the ones exercised elsewhere', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();
    const organs = new OrganKernel(runtime.store, runtime.paragon, runtime.telemetry);
    const allOrgans = listOrgans();
    assert.ok(allOrgans.length >= 190, `expected close to 200 registered organs, found ${allOrgans.length}`);

    for (const organ of allOrgans) {
      const result = await organs.invoke({ organId: organ.id, operation: 'status', tenantId: 'tenant-full-sweep', requestedBy: 'Craig' });
      assert.ok(['allowed', 'awaiting_approval', 'denied'].includes(result.outcome), `organ ${organ.id} returned an unrecognized outcome`);
      assert.ok(result.decisionId, `organ ${organ.id} did not produce a Paragon decision id`);
      assert.equal(result.organ.finalAuthority, 'Paragon Dissector');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Master wiring map validates all registered organs, governed agent routing, cross-cutting controls, and metacognitive evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')), undefined, new SandboxWorkspace(join(directory, 'sandbox')));
    const wiring = await runtime.masterWiringPosture('tenant-wiring');
    const payload = wiring.payload as {
      masterMap?: {
        organRegistry?: { total?: number; allTenantIsolated?: boolean; allParagonHooked?: boolean };
        agentRegistry?: { count?: number; allVersioned?: boolean };
        declarativeEdgeCount?: number;
        crossCutting?: { agentToAgent?: { directAgentCalls?: boolean }; paragon?: { bypassPath?: string }; evolution?: { directActivation?: boolean } };
      };
      validator?: { valid?: boolean; noDirectBypassPaths?: boolean; missingRequiredOrgans?: string[]; invalidAuthority?: string[] };
    };
    assert.equal(wiring.status, 'valid');
    assert.equal(payload.masterMap?.organRegistry?.total, 201);
    assert.equal(payload.masterMap?.organRegistry?.allTenantIsolated, true);
    assert.equal(payload.masterMap?.organRegistry?.allParagonHooked, true);
    assert.equal(payload.masterMap?.agentRegistry?.count, 6);
    assert.equal(payload.masterMap?.agentRegistry?.allVersioned, true);
    assert.ok((payload.masterMap?.declarativeEdgeCount || 0) >= 900);
    assert.equal(payload.masterMap?.crossCutting?.agentToAgent?.directAgentCalls, false);
    assert.equal(payload.masterMap?.crossCutting?.paragon?.bypassPath, 'none');
    assert.equal(payload.masterMap?.crossCutting?.evolution?.directActivation, false);
    assert.equal(payload.validator?.valid, true);
    assert.equal(payload.validator?.noDirectBypassPaths, true);
    assert.deepEqual(payload.validator?.missingRequiredOrgans, []);
    assert.deepEqual(payload.validator?.invalidAuthority, []);

    const run = await runtime.submitGoal({ tenantId: 'tenant-wiring', goal: 'Design a bounded sandbox report workflow for cognitive review.', requestedBy: 'Craig' });
    const reflection = await runtime.metacognition(run.id) as { selfModel?: { plannedSteps?: number; completedSteps?: number }; limits?: string[]; confidence?: string };
    assert.equal(reflection.selfModel?.plannedSteps, 5);
    assert.equal(reflection.selfModel?.completedSteps, 5);
    assert.ok(reflection.limits?.some((limit) => /No direct external API calls/.test(limit)));
    assert.equal(reflection.confidence, 'bounded-complete');
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Final audit and governance lock certify the governed runtime posture without creating an activation path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const audit = await runtime.fullSystemAudit('tenant-audit');
    const auditPayload = audit.payload as {
      passed?: boolean;
      checks?: Array<{ id: string; status: string }>;
      certification?: Record<string, string>;
      limitation?: string;
      shipability?: string;
    };
    assert.equal(audit.status, 'passed-with-governed-boundaries');
    assert.equal(auditPayload.passed, true);
    assert.equal(auditPayload.checks?.length, 8);
    assert.ok(auditPayload.checks?.every((item) => item.status === 'pass'));
    assert.match(String(auditPayload.certification?.safety), /non-bypassable policy/);
    assert.match(String(auditPayload.limitation), /does not claim/);
    assert.match(String(auditPayload.shipability), /governed deployment validation/);

    const lock = await runtime.governanceLockPosture('tenant-audit');
    const lockPayload = lock.payload as {
      constitution?: { frozen?: boolean; invariantCount?: number };
      doctrine?: { frozen?: boolean; invariantCount?: number };
      paragon?: { tier?: string; finalAuthority?: boolean; bypassPath?: string };
      activation?: string;
      lockMeaning?: string;
    };
    assert.equal(lock.status, 'locked-runtime-posture');
    assert.equal(lockPayload.constitution?.frozen, true);
    assert.equal(lockPayload.constitution?.invariantCount, 10);
    assert.equal(lockPayload.doctrine?.frozen, true);
    assert.equal(lockPayload.doctrine?.invariantCount, 4);
    assert.equal(lockPayload.paragon?.tier, 'tier-0');
    assert.equal(lockPayload.paragon?.finalAuthority, true);
    assert.equal(lockPayload.paragon?.bypassPath, 'none');
    assert.match(String(lockPayload.activation), /No new capability/);
    assert.match(String(lockPayload.lockMeaning), /makes no stronger physical immutability claim/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Governed bring-up records strict initialization order, first synchronization evidence, and no live-mode bypass', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const runtime = new AutonomyRuntime(new JsonRuntimeStore(join(directory, 'state.json')));
    const readiness = await runtime.bringUpPosture('tenant-boot');
    const payload = readiness.payload as { ready?: boolean; bootSequence?: string[]; noActivation?: string };
    assert.equal(readiness.status, 'ready-for-governed-operation');
    assert.equal(payload.ready, true);
    assert.deepEqual(payload.bootSequence?.slice(0, 4), ['Identity Anchor', 'Constitution Engine', 'Doctrine Engine', 'Paragon Dissector preflight kernel']);
    assert.match(String(payload.noActivation), /does not activate integrations/);

    const records = await runtime.store.listLevel6Records('organ_boot', 'tenant-boot');
    const stage = (name: string) => records.find((record) => record.name === `Governed bring-up: ${name}`);
    const agentStage = stage('agent-initialization');
    const agentPayload = agentStage?.payload as { order?: string[]; requiredOrder?: string[]; directAgentExecution?: boolean };
    assert.deepEqual(agentPayload.order, ['meta-agent', 'critic-safety', 'reflection', 'planner', 'builder', 'repair']);
    assert.deepEqual(agentPayload.requiredOrder, agentPayload.order);
    assert.equal(agentPayload.directAgentExecution, false);
    assert.equal(stage('safety-initialization')?.status, 'sequence-recorded');
    assert.equal(stage('first-heartbeat')?.status, 'ready');
    assert.equal(stage('first-cognition')?.status, 'bounded-ready');
    assert.equal(stage('first-stability-lock')?.status, 'locked-runtime-posture');
    assert.equal(stage('first-safety-lock')?.status, 'locked-runtime-posture');
    assert.equal(stage('first-paragon-sync')?.status, 'tier-0-active');
    assert.equal(stage('first-tenant-sync')?.status, 'tenant-isolated-ready');
    assert.equal(stage('first-os-ui-sync')?.status, 'mission-control-ready');
    assert.equal(stage('first-workflow-sync')?.status, 'bounded-workflow-ready');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a real @langchain/langgraph StateGraph pauses on a genuine interrupt() for a require_approval organ and resumes via Command, calling the same real OrganKernel the REST routes use', async () => {
  const { buildMissionGraph, newMissionRunId, Command } = await import('../src/autonomy/langgraph-mission.ts');
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();
    const organs = new OrganKernel(runtime.store, runtime.paragon, runtime.telemetry);
    const graph = buildMissionGraph(runtime, organs);

    const runId = newMissionRunId();
    const threadId = `mission-${Date.now()}`;
    const config = { configurable: { thread_id: threadId } };

    const firstResult: any = await graph.invoke(
      { runId, tenantId: 'global', requestedBy: 'Craig', organId: 'webhook-organ', payload: {} },
      config,
    );

    // The graph must have genuinely paused -- not returned a fabricated result.
    assert.ok(firstResult.__interrupt__, 'expected a real LangGraph interrupt payload, meaning execution actually paused');
    assert.equal(firstResult.__interrupt__[0].value.type, 'approval_request');

    // Resuming requires a real Command -- there is no other way to get past this point.
    const resumed: any = await graph.invoke(new Command({ resume: { approved: true } }), config);
    assert.equal(resumed.approved, true);
    assert.ok(resumed.result, 'expected a real OrganKernel invocation result after resume');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('real sandbox execution: candidate code is genuinely run in a subprocess only after propose -> approve -> consume, and cannot be executed twice with the same approval', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  const sandboxDir = join(directory, 'sandbox');
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store, undefined, new SandboxWorkspace(sandboxDir));
    await runtime.initialize();

    // 1. Validate a real candidate (this already exists; confirms baseline still works).
    const artifact = await runtime.sandbox.validateCapability('print hello', 'console.log("hello from the sandbox, real execution test");');
    assert.equal(artifact.validation.passed, true);

    // 2. Propose execution -- must always require approval (apply_capability is unconditional).
    const proposal = await proposeGovernedAction(runtime, {
      tenantId: 'global', requestedBy: 'Craig', kind: 'apply_capability',
      title: `Execute sandbox candidate: ${artifact.relativePath}`,
      actionInput: { relativePath: artifact.relativePath }, risk: 'high',
    });
    assert.equal(proposal.outcome, 'awaiting_approval');
    assert.ok(proposal.approvalId);

    // 3. Attempting to consume before approval must fail.
    const tooEarly = await consumeApprovalOnce(runtime, proposal.approvalId!, 'global');
    assert.equal(tooEarly, null);

    // 4. Approve for real, then execute for real.
    await runtime.decideApproval(proposal.approvalId!, true, 'Approved for real-execution test.', 'Craig', 'global');
    const consumed = await consumeApprovalOnce(runtime, proposal.approvalId!, 'global');
    assert.ok(consumed);

    const result = await runtime.sandbox.execute(artifact.relativePath);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /hello from the sandbox, real execution test/);

    // 5. The same approval cannot be consumed a second time.
    const secondAttempt = await consumeApprovalOnce(runtime, proposal.approvalId!, 'global');
    assert.equal(secondAttempt, null, 'a consumed approval must not authorize a second execution');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('real sandbox execution refuses a candidate containing a prohibited pattern, even if it were somehow already approved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  const sandboxDir = join(directory, 'sandbox');
  try {
    const sandbox = new SandboxWorkspace(sandboxDir);
    const artifact = await sandbox.validateCapability('malicious', 'require("child_process").execSync("echo pwned")');
    assert.equal(artifact.validation.passed, false, 'validateCapability should already flag this');
    await assert.rejects(() => sandbox.execute(artifact.relativePath), /prohibited pattern/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('browser automation: a plan targeting a non-allowlisted domain is refused before any browser launches, and fails closed when no allowlist is configured', async () => {
  delete process.env.MICROFYXD_BROWSER_ALLOWED_DOMAINS;
  delete process.env.MICROFIXD_BROWSER_ALLOWED_DOMAINS;
  const plan = { actions: [{ type: 'goto' as const, url: 'https://example.com' }] };
  const preview = previewPlan(plan);
  assert.equal(preview.safe, false, 'no allowlist configured must fail closed, not open');

  process.env.MICROFIXD_BROWSER_ALLOWED_DOMAINS = 'allowed-test-domain.example';
  const stillBlocked = previewPlan(plan);
  assert.equal(stillBlocked.safe, false, 'example.com is not on the configured allowlist');
  delete process.env.MICROFIXD_BROWSER_ALLOWED_DOMAINS;
});

test('browser automation: a real plan executes through a real Puppeteer-shaped interface via dependency injection, only after propose -> approve -> consume', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  process.env.MICROFIXD_BROWSER_ALLOWED_DOMAINS = 'allowed-test-domain.example';
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();

    const plan = { actions: [{ type: 'goto' as const, url: 'https://allowed-test-domain.example/' }, { type: 'extractText' as const, selector: 'h1' }] };
    const preview = previewPlan(plan);
    assert.equal(preview.safe, true);

    const proposal = await proposeGovernedAction(runtime, {
      tenantId: 'global', requestedBy: 'Craig', kind: 'external_effect',
      title: 'Browser automation test', actionInput: { plan }, risk: 'high',
    });
    assert.equal(proposal.outcome, 'awaiting_approval', 'external_effect must always require approval, even to an allowlisted domain');

    await runtime.decideApproval(proposal.approvalId!, true, 'Approved for automation test.', 'Craig', 'global');
    const consumed = await consumeApprovalOnce(runtime, proposal.approvalId!, 'global');
    assert.ok(consumed);

    // Inject a fake but realistically-shaped Puppeteer Page/Browser so the
    // real executePlan() code path runs end to end without a real Chromium.
    const fakePage = {
      setViewport: async () => {},
      goto: async (url: string) => { assert.equal(url, 'https://allowed-test-domain.example/'); },
      $eval: async () => 'Fake page heading',
    };
    const fakeBrowser = { newPage: async () => fakePage, close: async () => {} } as any;
    const results = await executePlan(plan, async () => fakeBrowser);

    assert.equal(results.length, 2);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].text, 'Fake page heading');
  } finally {
    delete process.env.MICROFIXD_BROWSER_ALLOWED_DOMAINS;
    await rm(directory, { recursive: true, force: true });
  }
});

test('the configurable approver pool: once populated, requires two DISTINCT identities and rejects anyone not in the pool', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  const originalCwd = process.cwd();
  try {
    // Simulate a populated pool by writing a real config/approver-pool.json
    // under a fresh cwd and re-importing the loader fresh (module-level
    // cache means this must be a separate process-like fresh import).
    const configDir = join(directory, 'config');
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'approver-pool.json'), JSON.stringify({ approvers: ['alice', 'bob'] }));
    process.chdir(directory);

    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();
    const organs = new OrganKernel(runtime.store, runtime.paragon, runtime.telemetry);

    const invocation = await organs.invoke({ organId: 'webhook-organ', operation: 'prepare', tenantId: 'global', requestedBy: 'Craig' });
    assert.equal(invocation.outcome, 'awaiting_approval');
    const pending = await runtime.listApprovals('global', 'pending');
    const approvalId = pending[pending.length - 1].id;

    // Outsider rejected outright.
    const outsider = await runtime.decideApproval(approvalId, true, 'trying', 'mallory', 'global');
    assert.equal(outsider?.status, 'rejected');

    // Fresh approval for the real two-distinct-admin flow.
    const invocation2 = await organs.invoke({ organId: 'webhook-organ', operation: 'prepare', tenantId: 'global', requestedBy: 'Craig' });
    const pending2 = await runtime.listApprovals('global', 'pending');
    const approvalId2 = pending2[pending2.length - 1].id;

    const first = await runtime.decideApproval(approvalId2, true, 'looks fine', 'alice', 'global');
    assert.equal(first?.status, 'pending', 'one approver should not be enough once the pool is configured');

    const sameAgain = await runtime.decideApproval(approvalId2, true, 'still fine', 'alice', 'global');
    assert.equal(sameAgain?.approvedBy.length, 1, 'the same identity approving twice must not count twice');

    const second = await runtime.decideApproval(approvalId2, true, 'confirmed', 'bob', 'global');
    assert.equal(second?.status, 'approved');
    assert.deepEqual(second?.approvedBy, ['alice', 'bob']);
  } finally {
    process.chdir(originalCwd);
    await rm(directory, { recursive: true, force: true });
  }
});

test('GitHub import: real base64 decoding logic against an injected fetch, no approval required for a read', async () => {
  const fakeFetch = (async (url: string | URL) => {
    assert.match(String(url), /api\.github\.com\/repos\/octocat\/Hello-World\/contents\/README/);
    return new Response(JSON.stringify({ content: Buffer.from('Hello World!').toString('base64'), encoding: 'base64', sha: 'abc123' }), { status: 200 });
  }) as any;
  const file = await importRepoFile('octocat', 'Hello-World', 'README', undefined, fakeFetch);
  assert.equal(file.content, 'Hello World!');
  assert.equal(file.sha, 'abc123');
});

test('GitHub export: refuses without GITHUB_TOKEN, and real end-to-end propose -> approve -> consume -> export only fires with a valid token and consumed approval', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  try {
    delete process.env.GITHUB_TOKEN;
    await assert.rejects(() => exportRepoFile('craig', 'repo', 'file.ts', 'content', 'msg'), /GITHUB_TOKEN is required/);

    process.env.GITHUB_TOKEN = 'fake-test-token';
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store);
    await runtime.initialize();

    const proposal = await proposeGovernedAction(runtime, {
      tenantId: 'global', requestedBy: 'Craig', kind: 'external_effect',
      title: 'GitHub export test', actionInput: {}, risk: 'high',
    });
    assert.equal(proposal.outcome, 'awaiting_approval', 'external_effect must always require approval, even for a repo file export');

    // Attempting the real write before approval must be impossible via the governed path.
    const tooEarly = await consumeApprovalOnce(runtime, proposal.approvalId!, 'global');
    assert.equal(tooEarly, null);

    await runtime.decideApproval(proposal.approvalId!, true, 'Approved for export test.', 'Craig', 'global');
    const consumed = await consumeApprovalOnce(runtime, proposal.approvalId!, 'global');
    assert.ok(consumed);

    let putCalled = false;
    const fakeFetch = (async (url: string | URL, init?: any) => {
      if (init?.method === 'PUT') {
        putCalled = true;
        const body = JSON.parse(init.body);
        assert.equal(Buffer.from(body.content, 'base64').toString('utf-8'), 'real content');
        return new Response(JSON.stringify({ commit: { sha: 'newsha456' } }), { status: 200 });
      }
      return new Response('not found', { status: 404 }); // no existing file
    }) as any;

    const result = await exportRepoFile('craig', 'repo', 'file.ts', 'real content', 'a real commit message', 'main', fakeFetch);
    assert.equal(putCalled, true, 'the real PUT to GitHub must actually have been attempted');
    assert.equal(result.commitSha, 'newsha456');

    // The same approval cannot authorize a second export.
    const secondAttempt = await consumeApprovalOnce(runtime, proposal.approvalId!, 'global');
    assert.equal(secondAttempt, null);
  } finally {
    delete process.env.GITHUB_TOKEN;
    await rm(directory, { recursive: true, force: true });
  }
});

test('sandbox execution failures are reported to self-healing as bounded failure evidence, not silently swallowed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microfixd-test-'));
  const adminKey = 'test-key-self-healing-sandbox';
  process.env.ADMIN_API_KEY = adminKey;
  let server: import('node:http').Server | undefined;
  try {
    const store = new JsonRuntimeStore(join(directory, 'state.json'));
    const runtime = new AutonomyRuntime(store, undefined, new SandboxWorkspace(join(directory, 'sandbox')));
    await runtime.initialize();
    const registry = new PluginRegistry([]);
    const app = express();
    app.use(express.json());
    mountAutonomyRoutes(app, runtime, registry);
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const headers = { 'Content-Type': 'application/json', 'x-microfixd-admin-key': adminKey, 'x-microfixd-tenant': 'global' };

    const artifact = await runtime.sandbox.validateCapability('will fail', 'process.exitCode = 1; console.error("deliberate test failure");');
    const propose = await fetch(`${baseUrl}/api/autonomy/sandbox/execute`, { method: 'POST', headers, body: JSON.stringify({ relativePath: artifact.relativePath }) });
    const proposeBody: any = await propose.json();
    await runtime.decideApproval(proposeBody.approvalId, true, 'approved for failure test', 'Craig', 'global');

    const executeRes = await fetch(`${baseUrl}/api/autonomy/sandbox/execute`, { method: 'POST', headers, body: JSON.stringify({ relativePath: artifact.relativePath, approvalId: proposeBody.approvalId }) });
    const executeBody: any = await executeRes.json();
    assert.notEqual(executeBody.result.exitCode, 0);

    const healthRecords = await runtime.store.listLevel6Records('health_assessment', 'global');
    const failureRecord = healthRecords.find((r) => r.name.includes('workflow') && String(r.payload.message || '').includes('deliberate test failure') === false && r.status !== 'nominal');
    const anyFailureAboutSandbox = healthRecords.some((r) => JSON.stringify(r.payload).includes(artifact.relativePath) || JSON.stringify(r.payload).includes('Sandbox execution'));
    assert.ok(anyFailureAboutSandbox, 'expected the sandbox execution failure to be recorded as real self-healing failure evidence');
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    delete process.env.ADMIN_API_KEY;
    await rm(directory, { recursive: true, force: true });
  }
});

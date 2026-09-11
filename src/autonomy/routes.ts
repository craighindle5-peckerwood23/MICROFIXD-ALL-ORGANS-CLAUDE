import { timingSafeEqual, randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { OmniRouter, PluginRegistry, type RouterRequest } from './omni-router.ts';
import { getOrgan, listOrgans, organSummary } from './organ-registry.ts';
import { OrganKernel } from './organ-kernel.ts';
import { AutonomyRuntime } from './runtime.ts';
import { VisualSnapshotOrgan } from './auxiliary-organs.ts';
import { ChatOrgan } from './chat.ts';
import { ParagonGateway, type GatewayEnvelope } from './gateway.ts';
import { UploadStore } from './uploads.ts';
import { proposeGovernedAction, consumeApprovalOnce } from './governed-execution.ts';
import { proposeWithTier, executeCriticalSafeAction } from './approval-tiers.ts';
import { assessCapability, summarizeSelfModel } from './genesis-self-model.ts';
import { rebuild, getPreviewStatus } from './preview.ts';
import { loadMcpServers, listServerTools, callServerTool } from './mcp-adapter.ts';
import { registerProject, listProjects, distillSemanticMemory, recallProcedure } from './world-model.ts';
import { listCreatorLabProjects, writeCreatorLabFiles, deleteCreatorLabProject, submitCreatorLabProject, slugifyProjectName } from './creator-lab.ts';
import { readWorkspaceFile, listWorkspaceDirectory, writeFiles } from './file-writer.ts';
import { previewPlan, executePlan, type BrowserPlan } from './browser-automation.ts';
import { SelfHealingControlPlane } from './self-healing.ts';
import { importRepoFile, exportRepoFile, proposeChangeAsPullRequest } from './github-integration.ts';
import { callExternalApi } from './internet-agent.ts';
import { triggerRenderDeploy, getRenderDeployStatus, getRenderDeployLogs, triggerRailwayRedeploy, getRailwayDeploymentStatus, getRailwayDeployLogs, extractDeployErrorSignals } from './deployment-agent.ts';
import { synthesizeSpeech } from './voice.ts';
import { generateFiles } from './generate.ts';
import { MetaLearningControlPlane } from './meta-learning.ts';
import { RepairControlPlane } from './level6.ts';
import { SelfEvolvingControlPlane } from './self-evolving.ts';
import { MetaObserver } from './meta-observer.ts';
import { MetaAnalyzer } from './meta-analyzer.ts';
import { MetaHealer } from './meta-healer.ts';
import { MetaStrategist } from './meta-strategist.ts';
import { MetaEvolver } from './meta-evolver.ts';
import { browseAndExtract, submitForm, login, runWorkflow, type WorkflowStep } from './http-dom-automation.ts';
import { verify, type SignedEnvelope } from './signing.ts';
import { executeWebTask, detectWebAutomationBackend } from './web-automation-adapter.ts';
import { MODEL_REGISTRY } from './model-registry.ts';

export const mountAutonomyRoutes = (app: Express, runtime: AutonomyRuntime, registry: PluginRegistry): void => {
  const router = new OmniRouter(registry, runtime.paragon, runtime.store, runtime.telemetry);
  const organs = new OrganKernel(runtime.store, runtime.paragon, runtime.telemetry, runtime.sandbox);
  const chat = new ChatOrgan(runtime, organs);
  const gateway = new ParagonGateway(runtime, runtime.paragon);
  const uploads = new UploadStore();

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'microfixd', tier0: 'Paragon Dissector', uptimeSeconds: Math.floor(process.uptime()) });
  });

  app.get('/readyz', async (_req, res) => {
    try {
      const storage = await runtime.store.health();
      const durableRequired = process.env.REQUIRE_DURABLE_MEMORY === 'true';
      if (durableRequired && !storage.durable) {
        res.status(503).json({ status: 'failed', reason: 'Durable Postgres memory is required but DATABASE_URL is not configured.', storage });
        return;
      }
      res.status(200).json({ status: storage.durable ? 'ok' : 'degraded', storage, tier0: 'Paragon Dissector' });
    } catch (error) {
      res.status(503).json({ status: 'failed', reason: (error as Error).message });
    }
  });

  app.get('/metrics', (_req, res) => {
    res.type('text/plain; version=0.0.4').send(runtime.telemetry.metrics());
  });

  // The registry contains no credentials or integration secrets and is safe to expose as guided system architecture.
  app.get('/api/autonomy/organs', (req, res) => {
    const family = Number(req.query.family || 0);
    const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
    const organs = listOrgans().filter((organ) => (!family || organ.familyNumber === family) && (!mode || organ.mode === mode));
    res.json({ summary: organSummary(), organs });
  });
  app.get('/api/autonomy/organs/:organId', (req, res) => {
    const organ = getOrgan(req.params.organId);
    if (!organ) {
      res.status(404).json({ error: 'Organ not found.' });
      return;
    }
    res.json({ organ, authority: 'Paragon Dissector Tier-0' });
  });

  app.use('/api/autonomy', requireAdmin);

  // The single free-text surface for the whole system: the chat box
  // under the holographic head talks to this one route, which fans out
  // to whichever governed organ/runtime method actually answers the
  // question. No new authority -- see chat.ts.
  app.post('/api/autonomy/chat', asyncHandler(async (req, res) => {
    const utterance = typeof req.body?.message === 'string' ? req.body.message : '';
    const tenantId = tenantIdFrom(req);
    const requestedBy = typeof req.body?.requestedBy === 'string' ? req.body.requestedBy : 'Craig';
    const result = await chat.route(utterance, { tenantId, requestedBy });
    const statusCode = result.status === 'ok' ? 200 : result.status === 'awaiting_approval' ? 202 : result.status === 'not_understood' ? 200 : 403;
    res.status(statusCode).json(result);
  }));

  // Generic actor/intent/context ingress. Same policy engine, same
  // approval queue, same audit trail as the organ routes above -- see
  // gateway.ts for exactly what is and isn't different from a naive
  // "admin key in the body" design.
  app.post('/api/autonomy/gateway', asyncHandler(async (req, res) => {
    const body = req.body as Partial<GatewayEnvelope> | undefined;
    if (!body?.actor?.id || !body?.actor?.role || !body?.intent?.type) {
      res.status(400).json({ error: 'Envelope must include actor.id, actor.role, and intent.type.' });
      return;
    }
    if ((body.actor as Record<string, unknown>).admin_key) {
      res.status(400).json({ error: 'actor.admin_key is not accepted in the request body. Authenticate with the x-microfixd-admin-key header instead.' });
      return;
    }
    const envelope: GatewayEnvelope = { actor: { id: body.actor.id, role: body.actor.role, scopes: body.actor.scopes }, intent: { type: body.intent.type, payload: body.intent.payload }, context: body.context };
    const response = await gateway.handle(envelope, envelope.actor.id);
    const statusCode = response.decision === 'ALLOWED' ? 200 : response.decision === 'PENDING_APPROVAL' ? 202 : 403;
    res.status(statusCode).json(response);
  }));

  // File upload through the chat interface: photos, zips, OBD2 diagnostic
  // exports, or anything else. Written to a directory-confined location on
  // disk (see uploads.ts). The upload itself needs no Paragon decision --
  // it is a storage operation, not an action against a system -- but it
  // is durably logged as a UsageEvent with a real dataRef (the file id) so
  // anything later that acts on this file is traceable back to it.
  app.post('/api/autonomy/upload', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { filename?: string; mimeType?: string; base64Content?: string; requestedBy?: string } | undefined;
    if (!body?.filename || !body?.base64Content) {
      res.status(400).json({ error: 'Body must include filename and base64Content.' });
      return;
    }
    try {
      const stored = await uploads.save(body.filename, body.mimeType || 'application/octet-stream', body.base64Content);
      await runtime.store.appendUsageEvent({
        id: stored.id,
        tenantId,
        kind: 'upload',
        name: stored.filename,
        actorId: body.requestedBy || 'Craig',
        dataRefs: [stored.id],
        metadata: { mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, sha256: stored.sha256 },
        createdAt: stored.createdAt,
      });
      res.status(201).json({ upload: stored, note: 'Stored on local disk under MICROFIXD_UPLOADS_DIR. This does not survive a redeploy without a persistent volume; the usage record does.' });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }));

  // ---- Real sandbox code execution ----------------------------------
  // Two-phase, like every other governed real action in this backend:
  // phase 1 proposes (always requires approval -- apply_capability is
  // unconditional in governance.ts), phase 2 consumes the approval
  // exactly once and actually runs the code.
  app.post('/api/autonomy/sandbox/execute', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { relativePath?: string; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.relativePath) {
      res.status(400).json({ error: 'Body must include relativePath (the sandbox candidate file to execute).' });
      return;
    }
    const requestedBy = body.requestedBy || 'Craig';

    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, {
        tenantId, requestedBy, kind: 'apply_capability',
        title: `Execute sandbox candidate: ${body.relativePath}`,
        actionInput: { relativePath: body.relativePath }, risk: 'high',
      });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }

    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) {
      res.status(403).json({ error: 'No valid, approved, unconsumed approval was found for that approvalId.' });
      return;
    }
    try {
      const result = await runtime.sandbox.execute(body.relativePath);
      await runtime.store.appendUsageEvent({
        id: randomUUID(), tenantId, kind: 'sandbox_execution', name: body.relativePath, actorId: requestedBy,
        dataRefs: [body.approvalId], metadata: { exitCode: result.exitCode, timedOut: result.timedOut, durationMs: result.durationMs },
        createdAt: new Date().toISOString(),
      });
      // Real integration with self-healing: a non-zero exit or a timeout
      // is bounded failure evidence, not silently swallowed. This does
      // NOT trigger any automatic repair (SelfHealingControlPlane never
      // auto-repairs, by design) -- it just makes the failure visible to
      // the same failure-detection posture every other subsystem reports
      // through, so a pattern of repeated sandbox failures is actually
      // observable instead of living only in one HTTP response.
      if (result.exitCode !== 0 || result.timedOut) {
        await SelfHealingControlPlane.recordFailure(runtime.store, {
          tenantId, scope: 'workflow', severity: result.timedOut ? 'critical' : 'warning',
          message: `Sandbox execution of "${body.relativePath}" ${result.timedOut ? 'timed out' : `exited with code ${result.exitCode}`}.`,
          runId: approval.runId, evidence: { stderr: result.stderr.slice(0, 2000), exitCode: result.exitCode, timedOut: result.timedOut },
        });
      }
      res.json({ executed: true, result });
    } catch (error) {
      await SelfHealingControlPlane.recordFailure(runtime.store, {
        tenantId, scope: 'workflow', severity: 'critical',
        message: `Sandbox execution of "${body.relativePath}" threw before completing: ${(error as Error).message}`,
        runId: approval.runId,
      });
      res.status(400).json({ error: (error as Error).message });
    }
  }));

  // ---- Real browser automation ---------------------------------------
  // Same two-phase pattern. Domain allowlist is enforced inside
  // browser-automation.ts and fails closed (no allowlist configured =
  // nothing is navigable) -- see MICROFIXD_BROWSER_ALLOWED_DOMAINS.
  app.post('/api/autonomy/browser/execute', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { plan?: BrowserPlan; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.plan?.actions?.length) {
      res.status(400).json({ error: 'Body must include a plan with at least one action.' });
      return;
    }
    const requestedBy = body.requestedBy || 'Craig';
    const preview = previewPlan(body.plan);

    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, {
        tenantId, requestedBy, kind: 'external_effect',
        title: `Browser automation: ${body.plan.actions.map((a) => a.type).join(' -> ')}`,
        actionInput: { plan: body.plan, preview }, risk: 'high',
      });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons, preview });
      return;
    }

    if (!preview.safe) {
      res.status(400).json({ error: `Plan is not safe to execute: ${preview.issues.join(' ')}` });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) {
      res.status(403).json({ error: 'No valid, approved, unconsumed approval was found for that approvalId.' });
      return;
    }
    try {
      const results = await executePlan(body.plan);
      await runtime.store.appendUsageEvent({
        id: randomUUID(), tenantId, kind: 'browser_automation', name: body.plan.actions.map((a) => a.type).join(','), actorId: requestedBy,
        dataRefs: [body.approvalId], metadata: { stepCount: results.length, allOk: results.every((r) => r.ok) },
        createdAt: new Date().toISOString(),
      });
      const failedStep = results.find((r) => !r.ok);
      if (failedStep) {
        await SelfHealingControlPlane.recordFailure(runtime.store, {
          tenantId, scope: 'workflow', severity: 'warning',
          message: `Browser automation step "${failedStep.action.type}" failed: ${failedStep.detail || 'no detail'}`,
          runId: approval.runId, evidence: { failedStep },
        });
      }
      res.json({ executed: true, results });
    } catch (error) {
      await SelfHealingControlPlane.recordFailure(runtime.store, {
        tenantId, scope: 'workflow', severity: 'critical',
        message: `Browser automation threw before completing: ${(error as Error).message}`,
        runId: approval.runId,
      });
      res.status(400).json({ error: (error as Error).message });
    }
  }));

  // ---- GitHub import/export -------------------------------------------
  // Import is safe and ungated (reading has no side effect). Export is a
  // real commit, gated the same two-phase way as sandbox execution and
  // browser automation.
  app.post('/api/autonomy/github/import', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { owner?: string; repo?: string; path?: string; ref?: string; requestedBy?: string } | undefined;
    if (!body?.owner || !body?.repo || !body?.path) {
      res.status(400).json({ error: 'Body must include owner, repo, and path.' });
      return;
    }
    try {
      const file = await importRepoFile(body.owner, body.repo, body.path, body.ref);
      await runtime.store.appendUsageEvent({
        id: randomUUID(), tenantId, kind: 'other', name: `github.import:${body.owner}/${body.repo}/${body.path}`,
        actorId: body.requestedBy || 'Craig', dataRefs: [file.sha || body.path], metadata: { owner: body.owner, repo: body.repo, path: body.path },
        createdAt: new Date().toISOString(),
      });
      res.json({ file });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }));

  app.post('/api/autonomy/github/export-batch', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { owner?: string; repo?: string; files?: Record<string, string>; message?: string; branch?: string; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.owner || !body?.repo || !body?.files || typeof body.files !== 'object' || !body?.message) {
      res.status(400).json({ error: 'Body must include owner, repo, files (a path->content map), and message.' });
      return;
    }
    const requestedBy = body.requestedBy || 'Craig';

    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, {
        tenantId, requestedBy, kind: 'external_effect',
        title: `GitHub batch export: ${body.owner}/${body.repo} (${Object.keys(body.files).length} files)`,
        actionInput: { owner: body.owner, repo: body.repo, fileCount: Object.keys(body.files).length, message: body.message }, risk: 'high',
      });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }

    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) {
      res.status(403).json({ error: 'No valid, approved, unconsumed approval was found for that approvalId.' });
      return;
    }
    try {
      // Real PR-based lifecycle, not a direct-to-branch push: creates a
      // new branch off body.branch (or 'main'), commits there, and
      // opens a real Pull Request. Merging remains a separate, human,
      // GitHub-side action -- this route can never land on the base
      // branch directly.
      const result = await proposeChangeAsPullRequest(body.owner, body.repo, body.files, {
        title: body.message, body: `Opened by Microfixd's governed GitHub export route. Requested by ${requestedBy}. Approval: ${body.approvalId}.`,
        baseBranch: body.branch, branchPrefix: 'microfixd-change',
      });
      await runtime.store.appendUsageEvent({
        id: randomUUID(), tenantId, kind: 'other', name: `github.export-batch:${body.owner}/${body.repo}`,
        actorId: requestedBy, dataRefs: [body.approvalId, result.commitSha, result.pullRequestUrl], metadata: { owner: body.owner, repo: body.repo, fileCount: result.fileCount, pullRequestUrl: result.pullRequestUrl },
        createdAt: new Date().toISOString(),
      });
      res.json({ exported: true, ...result });
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  }));

  // Internet agent: generic authenticated external API calls, governed
  // by the same domain allowlist as web automation.
  app.post('/api/autonomy/internet/call', requireRole('operator'), asyncHandler(async (req, res) => {
    res.json(await callExternalApi(req.body));
  }));

  // Deployment agent: real Render + Railway integration. Trigger is
  // gated as an external_effect (same propose/approve cycle as GitHub
  // export); status/logs are read-only and ungated.
  app.post('/api/autonomy/deploy/render/trigger', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { serviceId?: string; clearCache?: boolean; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.serviceId) { res.status(400).json({ error: 'serviceId is required.' }); return; }
    const requestedBy = body.requestedBy || 'Craig';
    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, { tenantId, requestedBy, kind: 'external_effect', title: `Trigger Render deploy: ${body.serviceId}`, actionInput: { serviceId: body.serviceId }, risk: 'high' });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    res.json(await triggerRenderDeploy(body.serviceId, body.clearCache ?? false));
  }));

  app.get('/api/autonomy/deploy/render/status', asyncHandler(async (req, res) => {
    res.json(await getRenderDeployStatus(String(req.query.serviceId || ''), String(req.query.deployId || '')));
  }));

  app.get('/api/autonomy/deploy/render/logs', asyncHandler(async (req, res) => { res.json(await getRenderDeployLogs()); }));

  app.post('/api/autonomy/deploy/railway/trigger', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { deploymentId?: string; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.deploymentId) { res.status(400).json({ error: 'deploymentId is required.' }); return; }
    const requestedBy = body.requestedBy || 'Craig';
    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, { tenantId, requestedBy, kind: 'external_effect', title: `Trigger Railway redeploy: ${body.deploymentId}`, actionInput: { deploymentId: body.deploymentId }, risk: 'high' });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    res.json(await triggerRailwayRedeploy(body.deploymentId));
  }));

  app.get('/api/autonomy/deploy/railway/status', asyncHandler(async (req, res) => {
    res.json(await getRailwayDeploymentStatus(String(req.query.projectId || ''), String(req.query.environmentId || ''), String(req.query.serviceId || '')));
  }));

  app.get('/api/autonomy/deploy/railway/logs', asyncHandler(async (req, res) => {
    const logsResult = await getRailwayDeployLogs(String(req.query.deploymentId || ''));
    const signals = logsResult.status === 'ok' && logsResult.logs ? extractDeployErrorSignals(logsResult.logs) : [];
    res.json({ ...logsResult, errorSignals: signals });
  }));

  app.post('/api/autonomy/github/export', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { owner?: string; repo?: string; path?: string; content?: string; message?: string; branch?: string; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.owner || !body?.repo || !body?.path || typeof body?.content !== 'string' || !body?.message) {
      res.status(400).json({ error: 'Body must include owner, repo, path, content, and message.' });
      return;
    }
    const requestedBy = body.requestedBy || 'Craig';

    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, {
        tenantId, requestedBy, kind: 'external_effect',
        title: `GitHub export: ${body.owner}/${body.repo}/${body.path}`,
        actionInput: { owner: body.owner, repo: body.repo, path: body.path, message: body.message }, risk: 'high',
      });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }

    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) {
      res.status(403).json({ error: 'No valid, approved, unconsumed approval was found for that approvalId.' });
      return;
    }
    try {
      const result = await exportRepoFile(body.owner, body.repo, body.path, body.content, body.message, body.branch);
      await runtime.store.appendUsageEvent({
        id: randomUUID(), tenantId, kind: 'other', name: `github.export:${body.owner}/${body.repo}/${body.path}`,
        actorId: requestedBy, dataRefs: [body.approvalId, result.commitSha], metadata: { owner: body.owner, repo: body.repo, path: body.path },
        createdAt: new Date().toISOString(),
      });
      res.json({ exported: true, ...result });
    } catch (error) {
      await SelfHealingControlPlane.recordFailure(runtime.store, {
        tenantId, scope: 'workflow', severity: 'warning',
        message: `GitHub export to ${body.owner}/${body.repo}/${body.path} failed: ${(error as Error).message}`,
        runId: approval.runId,
      });
      res.status(400).json({ error: (error as Error).message });
    }
  }));

  // Real self-learning signal, readable on demand: recomputed live from
  // actual evolution_assessment history each call, not cached from a
  // stale run.
  app.get('/api/autonomy/meta-learning/evolution-trust', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const trust = await MetaLearningControlPlane.assessEvolutionTrust(runtime.store, tenantId);
    res.json(trust);
  }));

  app.get('/api/autonomy/meta-learning/repair-trust', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const trust = await RepairControlPlane.assessRepairTrust(runtime.store, tenantId);
    res.json(trust);
  }));

  // Real strategy engine: profile is computed entirely from live data
  // (evolution/repair trust, averaged real drift across recent runs).
  // strategy is a pure function of that profile -- no randomness, no
  // placeholder fields.
  app.get('/api/autonomy/meta-learning/evolution-strategy', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const profile = await SelfEvolvingControlPlane.computeProfile(runtime.store, tenantId);
    const strategy = SelfEvolvingControlPlane.chooseStrategy(profile);
    const confidence = SelfEvolvingControlPlane.confidence(profile);
    res.json({ profile, strategy, confidence });
  }));

  app.get('/api/autonomy/meta/observe', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    res.json(await MetaObserver.observe(runtime.store, tenantId));
  }));

  app.get('/api/autonomy/meta/analyze', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    res.json(await MetaAnalyzer.analyze(runtime.store, tenantId));
  }));

  app.get('/api/autonomy/meta/decide', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    res.json(await MetaStrategist.decide(runtime.store, tenantId));
  }));

  // Real recommendation, not action -- see meta-healer.ts for why this
  // never auto-flips safe mode or restarts anything itself.
  app.post('/api/autonomy/meta/heal', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const assessment = await MetaAnalyzer.analyze(runtime.store, tenantId);
    res.json(await MetaHealer.recommend(runtime.store, assessment));
  }));

  app.get('/api/autonomy/meta/evolve', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    res.json(await MetaEvolver.recommend(runtime.store, tenantId));
  }));

  // Real Chromium-free web automation for environments (Termux/Android)
  // where the Playwright path can't run. Same governance boundary as
  // browser-automation.ts: every target checked against
  // MICROFIXD_BROWSER_ALLOWED_DOMAINS, no arbitrary JS execution.
  app.post('/api/autonomy/http-dom/browse', requireRole('operator'), asyncHandler(async (req, res) => {
    res.json(await browseAndExtract(String(req.body?.url || ''), Array.isArray(req.body?.actions) ? req.body.actions : []));
  }));

  app.post('/api/autonomy/http-dom/submit-form', requireRole('operator'), asyncHandler(async (req, res) => {
    res.json(await submitForm(String(req.body?.url || ''), String(req.body?.selector || ''), isRecord(req.body?.fields) ? req.body.fields as Record<string, string> : {}));
  }));

  app.post('/api/autonomy/http-dom/login', requireRole('operator'), asyncHandler(async (req, res) => {
    res.json(await login(String(req.body?.url || ''), String(req.body?.selector || ''), isRecord(req.body?.fields) ? req.body.fields as Record<string, string> : {}));
  }));

  app.post('/api/autonomy/http-dom/workflow', requireRole('operator'), asyncHandler(async (req, res) => {
    const steps = Array.isArray(req.body?.steps) ? req.body.steps as WorkflowStep[] : [];
    res.json(await runWorkflow(String(req.body?.startUrl || ''), steps));
  }));

  // Real signature verification, independent of this process's memory
  // -- given any signed envelope (e.g. one pulled from a stored
  // Level6Record's payload.signature), confirms it against the
  // currently-configured key set.
  app.post('/api/autonomy/signing/verify', asyncHandler(async (req, res) => {
    const envelope = req.body as SignedEnvelope;
    if (!envelope || typeof envelope.signature !== 'string' || typeof envelope.keyVersion !== 'string') {
      res.status(400).json({ error: 'Body must be a signed envelope: { payload, signature, keyVersion, signedAt }.' });
      return;
    }
    res.json(verify(envelope));
  }));

  // Real credential/config status for the OS shell's Runtime &
  // Operator Credentials panel -- reports whether things are
  // configured, never the values themselves.
  app.get('/api/autonomy/system/credential-status', asyncHandler(async (req, res) => {
    let signingKeyCount = 0;
    let activeKeyVersion: string | null = null;
    try {
      const parsed = JSON.parse(process.env.MICROFIXD_SIGNING_KEYS || '[]');
      if (Array.isArray(parsed)) { signingKeyCount = parsed.length; activeKeyVersion = parsed[0]?.version ?? null; }
    } catch { /* malformed config -> reported as zero keys, matches signing.ts's own real behavior */ }

    res.json({
      adminKeyConfigured: Boolean(process.env.ADMIN_API_KEY),
      signingKeysConfigured: signingKeyCount > 0,
      signingKeyCount, activeKeyVersion,
      githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN),
      renderApiKeyConfigured: Boolean(process.env.RENDER_API_KEY),
      railwayTokenConfigured: Boolean(process.env.RAILWAY_API_TOKEN),
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      valueExposure: 'disabled', // true by construction: no route in this backend ever echoes back a raw secret value
    });
  }));

  // Real capability check -- tells you which backend this deployment
  // will actually use right now (Chromium/Playwright vs HTTP-DOM), and
  // why, without running a task.
  app.get('/api/autonomy/web-automation/capability', asyncHandler(async (req, res) => {
    res.json(await detectWebAutomationBackend(req.query.force === 'true'));
  }));

  // Genesis self-model: honest capability confidence from real,
  // existing signals (organ-registry mode, evolution/repair track
  // record, evolver recommendations) -- never a fabricated aggregate
  // score.
  app.get('/api/autonomy/genesis/self-model', asyncHandler(async (req, res) => {
    res.json(summarizeSelfModel());
  }));

  app.get('/api/autonomy/genesis/assess/:organId', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    res.json(await assessCapability(runtime.store, tenantId, req.params.organId));
  }));

  // Real Laboratory preview: status is read-only; rebuild actually
  // runs the real build command and is governed, since a build that
  // fails partway could leave dist/ in a broken intermediate state.
  app.get('/api/autonomy/preview/status', asyncHandler(async (req, res) => {
    res.json(await getPreviewStatus());
  }));

  app.post('/api/autonomy/preview/rebuild', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { approvalId?: string; requestedBy?: string } | undefined;
    const requestedBy = body?.requestedBy || 'Craig';
    if (!body?.approvalId) {
      const proposal = await proposeGovernedAction(runtime, { tenantId, requestedBy, kind: 'apply_capability', title: 'Rebuild frontend/backend from current source', actionInput: {}, risk: 'medium' });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    res.json(await rebuild());
  }));

  // Real MCP adapter: listing servers/tools is read-only discovery,
  // ungated. Actually calling a tool is exactly as consequential as any
  // other external effect and is approval-gated the same way.
  app.get('/api/autonomy/mcp/servers', asyncHandler(async (req, res) => {
    res.json({ servers: loadMcpServers().map((s) => ({ id: s.id, url: s.url, authConfigured: Boolean(s.bearerTokenEnv && process.env[s.bearerTokenEnv]) })) });
  }));

  app.get('/api/autonomy/mcp/:serverId/tools', asyncHandler(async (req, res) => {
    try {
      res.json({ tools: await listServerTools(req.params.serverId) });
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  }));

  app.post('/api/autonomy/mcp/:serverId/call', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { toolName?: string; args?: Record<string, unknown>; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.toolName) { res.status(400).json({ error: 'Body must include toolName.' }); return; }
    const requestedBy = body.requestedBy || 'Craig';
    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, {
        tenantId, requestedBy, kind: 'external_effect',
        title: `MCP tool call: ${req.params.serverId}/${body.toolName}`,
        actionInput: { serverId: req.params.serverId, toolName: body.toolName, args: body.args || {} }, risk: 'high',
      });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    try {
      const result = await callServerTool(req.params.serverId, body.toolName, body.args || {});
      await runtime.store.appendUsageEvent({
        id: randomUUID(), tenantId, kind: 'other', name: `mcp.call:${req.params.serverId}/${body.toolName}`,
        actorId: requestedBy, dataRefs: [body.approvalId], metadata: { serverId: req.params.serverId, toolName: body.toolName, isError: result.isError },
        createdAt: new Date().toISOString(),
      });
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  }));

  // Real World Model: project registry (read/write, low risk -- a
  // structured label, not an external effect), semantic memory
  // distillation (read/compute, no side effect beyond writing durable
  // facts derived from the tenant's own real history), and procedural
  // recall (pure read).
  app.get('/api/autonomy/world-model/projects', asyncHandler(async (req, res) => {
    res.json({ projects: await listProjects(runtime.store, tenantIdFrom(req)) });
  }));

  app.post('/api/autonomy/world-model/projects', asyncHandler(async (req, res) => {
    const body = req.body as { name?: string; kind?: string; description?: string; relatedRepos?: string[]; relatedOrganIds?: string[] } | undefined;
    if (!body?.name || !body.kind || !body.description) { res.status(400).json({ error: 'Body must include name, kind, and description.' }); return; }
    const project = await registerProject(runtime.store, tenantIdFrom(req), { name: body.name, kind: body.kind as 'app' | 'service' | 'repo' | 'other', description: body.description, relatedRepos: body.relatedRepos, relatedOrganIds: body.relatedOrganIds });
    res.json(project);
  }));

  app.post('/api/autonomy/world-model/distill', asyncHandler(async (req, res) => {
    res.json({ facts: await distillSemanticMemory(runtime.store, tenantIdFrom(req)) });
  }));

  app.get('/api/autonomy/world-model/recall/:subject', asyncHandler(async (req, res) => {
    res.json(await recallProcedure(runtime.store, tenantIdFrom(req), req.params.subject));
  }));

  // Real workspace file routes for the Laboratory UI. Read/list are
  // ungated (no side effect, same reasoning as importRepoFile). Write
  // goes through the exact same propose -> approve -> consume cycle as
  // every other write path in this system -- the UI gets a button, not
  // a bypass.
  app.get('/api/autonomy/files/list', asyncHandler(async (req, res) => {
    res.json(await listWorkspaceDirectory(String(req.query.path || '.')));
  }));

  app.get('/api/autonomy/files/read', asyncHandler(async (req, res) => {
    res.json(await readWorkspaceFile(String(req.query.path || '')));
  }));

  app.post('/api/autonomy/files/write', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { path?: string; content?: string; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.path || body.content === undefined) { res.status(400).json({ error: 'path and content are required.' }); return; }
    const requestedBy = body.requestedBy || 'Craig';
    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, { tenantId, requestedBy, kind: 'apply_capability', title: `Write file: ${body.path}`, actionInput: { path: body.path, contentLength: body.content.length }, risk: 'medium' });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    res.json(await writeFiles({ [body.path]: body.content }));
  }));

  // Real Creator Lab: a separate playground for building apps/websites,
  // reusing existing real capabilities (file writes with the same real
  // reality-anchor + immutable-core checks, real GitHub submission) --
  // output lives under creator-lab/ so it's kept separate from
  // Microfixd's own source without needing a fully separate sandbox.
  app.get('/api/autonomy/creator-lab/projects', asyncHandler(async (req, res) => {
    res.json({ projects: await listCreatorLabProjects() });
  }));

  app.post('/api/autonomy/creator-lab/projects/:slug/files', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { files?: Record<string, string>; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.files || Object.keys(body.files).length === 0) { res.status(400).json({ error: 'files (a path->content map) is required.' }); return; }
    const slug = slugifyProjectName(req.params.slug);
    const requestedBy = body.requestedBy || 'Craig';
    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, { tenantId, requestedBy, kind: 'apply_capability', title: `Creator Lab write: ${slug} (${Object.keys(body.files).length} file(s))`, actionInput: { slug, fileCount: Object.keys(body.files).length }, risk: 'medium' });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    res.json(await writeCreatorLabFiles(slug, body.files));
  }));

  app.delete('/api/autonomy/creator-lab/projects/:slug', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { approvalId?: string; requestedBy?: string } | undefined;
    const slug = slugifyProjectName(req.params.slug);
    const requestedBy = body?.requestedBy || 'Craig';
    if (!body?.approvalId) {
      const proposal = await proposeGovernedAction(runtime, { tenantId, requestedBy, kind: 'apply_capability', title: `Delete Creator Lab project: ${slug}`, actionInput: { slug }, risk: 'medium' });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    res.json(await deleteCreatorLabProject(slug));
  }));

  app.post('/api/autonomy/creator-lab/projects/:slug/submit', requireRole('operator'), asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { submission?: Parameters<typeof submitCreatorLabProject>[1]; approvalId?: string; requestedBy?: string } | undefined;
    if (!body?.submission) { res.status(400).json({ error: 'submission is required -- { mode: "new-repo", repoName, ... } or { mode: "branch-pr", owner, repo, title, body }.' }); return; }
    const slug = slugifyProjectName(req.params.slug);
    const requestedBy = body.requestedBy || 'Craig';
    if (!body.approvalId) {
      const proposal = await proposeGovernedAction(runtime, { tenantId, requestedBy, kind: 'external_effect', title: `Submit Creator Lab project "${slug}" to GitHub (${body.submission.mode})`, actionInput: { slug, submission: body.submission }, risk: 'high' });
      res.status(202).json({ status: proposal.outcome, approvalId: proposal.approvalId, reasons: proposal.reasons });
      return;
    }
    const approval = await consumeApprovalOnce(runtime, body.approvalId, tenantId);
    if (!approval) { res.status(403).json({ error: 'No valid, approved, unconsumed approval found.' }); return; }
    try {
      res.json(await submitCreatorLabProject(slug, body.submission));
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  }));

  // Real critical-tier emergency path -- the ONLY way to skip approval
  // in this system. Never trusts a client-asserted "this is critical";
  // re-runs MetaAnalyzer server-side and only proceeds if it
  // independently confirms degraded=true right now.
  app.post('/api/autonomy/approval-tiers/critical-action', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const body = req.body as { action?: string; reason?: string; requestedBy?: string } | undefined;
    if (!body?.action || !body?.reason) { res.status(400).json({ error: 'action and reason are required.' }); return; }
    const assessment = await MetaAnalyzer.analyze(runtime.store, tenantId);
    const result = await executeCriticalSafeAction(runtime, {
      tenantId, requestedBy: body.requestedBy || 'Craig', action: body.action, reason: body.reason,
      systemCollapseConfirmed: assessment.degraded && assessment.anomalyScore >= 0.6,
    });
    res.json({ ...result, currentAnomalyScore: assessment.anomalyScore, currentlyDegraded: assessment.degraded });
  }));

  app.post('/api/autonomy/web-automation/execute', requireRole('operator'), asyncHandler(async (req, res) => {
    const url = String(req.body?.url || '');
    const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
    res.json(await executeWebTask(url, actions));
  }));

  // Real, auditable pinned-model list. Two clones running different
  // values here are provably running different models -- that's the
  // actual reproducibility check, not a trust-me claim.
  app.get('/api/autonomy/model-registry', asyncHandler(async (_req, res) => {
    res.json({ models: MODEL_REGISTRY });
  }));

  app.get('/api/autonomy/introspection', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'runtime-auditor', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ ...(await runtime.introspect()), governance });
  }));

  app.get('/api/autonomy/white-label', asyncHandler(async (req, res) => {
    const governance = await organs.invoke({ organId: 'style-organ', operation: 'status', tenantId: tenantIdFrom(req), requestedBy: 'Craig' });
    res.json({ settings: runtime.whiteLabelSettings(), governance });
  }));

  app.get('/api/autonomy/tenants', asyncHandler(async (req, res) => {
    const governance = await organs.invoke({ organId: 'tenant-registry', operation: 'status', tenantId: tenantIdFrom(req), requestedBy: 'Craig' });
    res.json({ tenants: await runtime.listTenants(), governance });
  }));

  app.post('/api/autonomy/tenants', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'tenant-registry', operation: 'prepare', tenantId, payload: { name: req.body?.name }, requestedBy: 'Craig' });
    if (governance.outcome !== 'allowed') { res.status(governance.outcome === 'awaiting_approval' ? 202 : 403).json({ governance }); return; }
    res.status(201).json({ tenant: await runtime.ensureTenant(tenantId, typeof req.body?.name === 'string' ? req.body.name : tenantId), governance });
  }));

  app.get('/api/autonomy/agents', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'agent-registry', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, agents: await runtime.listAgents(tenantId), governance });
  }));

  app.get('/api/autonomy/agents/posture', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'agent-oversight-organ', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, posture: await runtime.multiAgentPosture(tenantId), governance });
  }));

  app.get('/api/autonomy/compute', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'device-capability-organ', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, compute: runtime.computePosture(), governance });
  }));

  app.get('/api/autonomy/compute/posture', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'device-capability-organ', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, compute: await runtime.computeAssessment(tenantId), governance });
  }));

  app.get('/api/autonomy/infrastructure', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'device-capability-organ', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, infrastructure: await runtime.infrastructurePosture(tenantId), governance });
  }));

  app.get('/api/autonomy/safe-mode', asyncHandler(async (req, res) => {
    const governance = await organs.invoke({ organId: 'safe-mode-control-organ', operation: 'status', tenantId: tenantIdFrom(req), requestedBy: 'Craig' });
    res.json({ safeMode: await runtime.store.listLevel6Records('safe_mode', 'global'), governance });
  }));

  app.post('/api/autonomy/safe-mode', requireRole('admin'), asyncHandler(async (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') { res.status(400).json({ error: 'enabled must be a boolean.' }); return; }
    const governance = await organs.invoke({ organId: 'safe-mode-control-organ', operation: 'prepare', tenantId: tenantIdFrom(req), payload: { enabled: req.body.enabled }, requestedBy: String(req.body?.actor || 'Craig') });
    if (governance.outcome !== 'allowed') { res.status(governance.outcome === 'awaiting_approval' ? 202 : 403).json({ governance }); return; }
    res.json({ safeMode: await runtime.setSafeMode(req.body.enabled, String(req.body?.actor || 'Craig'), String(req.body?.reason || 'Operator action')), governance });
  }));

  app.get('/api/autonomy/runs/:runId/metacognition', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const detail = await runtime.getRunWithSteps(req.params.runId);
    if (!detail || detail.run.tenantId !== tenantId) { res.status(404).json({ error: 'Run not found in the active tenant.' }); return; }
    const governance = await organs.invoke({ organId: 'reflection-organ', operation: 'describe', runId: req.params.runId, tenantId, requestedBy: 'Craig' });
    const assessment = await runtime.metacognition(req.params.runId);
    if (!assessment) {
      res.status(404).json({ error: 'Run not found.' });
      return;
    }
    res.json({ assessment, governance });
  }));

  app.get('/api/autonomy/bring-up', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'organ-boot-layer', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, bringUp: await runtime.bringUpPosture(tenantId), governance });
  }));

  app.get('/api/autonomy/audit', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'runtime-auditor', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, audit: await runtime.fullSystemAudit(tenantId), governance });
  }));

  // Honest usage report: aggregates real telemetry, not a fabricated
  // "data lineage" system. The windowLimitation field in the response
  // says exactly what this is and isn't -- an in-memory, 500-event,
  // since-last-restart window, not durable cross-restart provenance
  // tracking. A real provenance/lineage system needs a persisted events
  // table in RuntimeStore; that's a schema change, not a route change,
  // and hasn't been built.
  app.get('/api/autonomy/usage-report', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'runtime-auditor', operation: 'status', tenantId, requestedBy: 'Craig' });
    const events = runtime.telemetry.recent(500);
    const byName: Record<string, number> = {};
    for (const event of events) byName[event.name] = (byName[event.name] || 0) + 1;
    const durable = await runtime.store.listUsageEvents(tenantId, 500);
    const byKind: Record<string, number> = {};
    for (const event of durable) byKind[event.kind] = (byKind[event.kind] || 0) + 1;
    res.json({
      tenantId,
      governance,
      inMemoryWindow: {
        eventCount: events.length,
        eventCountByType: byName,
        limitation: 'This part reflects only the most recent 500 telemetry events held in process memory since the server last started.',
      },
      durableHistory: {
        eventCount: durable.length,
        eventCountByKind: byKind,
        limitation: durable.length > 0 ? 'Cross-restart, tenant-scoped, up to the most recent 500 events. This is an event log with lineage tags (dataRefs), not a full relational provenance graph.' : 'No durable events recorded yet for this tenant, or DATABASE_URL is not configured (JSON fallback store also implements this, but resets if the deployment volume is not persistent).',
      },
      recentEvents: events,
      recentDurableEvents: durable,
    });
  }));

  app.get('/api/autonomy/governance-lock', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'paragon-dissector', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, governanceLock: await runtime.governanceLockPosture(tenantId), governance });
  }));

  app.get('/api/autonomy/wiring', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'organ-wiring-layer', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, wiring: await runtime.masterWiringPosture(tenantId), governance });
  }));

  app.get('/api/autonomy/self-healing', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'health-trigger-organ', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, selfHealing: await runtime.selfHealingPosture(tenantId), governance });
  }));

  app.get('/api/autonomy/web/posture', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'web-automation-organ', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, webUse: await runtime.webUsePosture(tenantId), governance });
  }));

  app.post('/api/autonomy/automotive/diagnostics', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'diagnostics-organ', operation: 'prepare', tenantId, payload: isRecord(req.body) ? req.body : {}, requestedBy: 'Craig' });
    if (governance.outcome !== 'allowed') {
      res.status(governance.outcome === 'awaiting_approval' ? 202 : 403).json({ governance });
      return;
    }
    const value = (field: 'coolantTempC' | 'oilTempC' | 'voltage' | 'rpm'): number | undefined => Number.isFinite(req.body?.[field]) ? Number(req.body[field]) : undefined;
    const codes = Array.isArray(req.body?.diagnosticCodes) ? req.body.diagnosticCodes.filter((code: unknown) => typeof code === 'string').slice(0, 50) : undefined;
    res.json({ diagnostics: await runtime.automotiveDiagnostics({ coolantTempC: value('coolantTempC'), oilTempC: value('oilTempC'), voltage: value('voltage'), rpm: value('rpm'), diagnosticCodes: codes }), governance });
  }));

  app.get('/api/autonomy/snapshot', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'cinematic-organ', operation: 'describe', runId: typeof req.query.runId === 'string' ? req.query.runId : undefined, tenantId, requestedBy: 'Craig' });
    res.json({ snapshot: await runtime.visualSnapshot(typeof req.query.runId === 'string' ? req.query.runId : undefined), governance });
  }));

  app.post('/api/autonomy/snapshot/screenshot', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'puppeteer-organ', operation: 'prepare', tenantId, payload: { requestedCapture: 'local-console-screenshot' }, requestedBy: 'Craig' });
    const runId = typeof req.body?.runId === 'string' ? req.body.runId : undefined;
    if (governance.outcome !== 'allowed') {
      res.status(governance.outcome === 'awaiting_approval' ? 202 : 403).json({ governance, snapshot: await runtime.visualSnapshot(runId), screenshot: { status: 'not-rendered', reason: 'Tier-0 Paragon did not permit this capture.' } });
      return;
    }
    if (process.env.MICROFIXD_ENABLE_LOCAL_SCREENSHOTS !== 'true') {
      res.status(202).json({ governance, snapshot: await runtime.visualSnapshot(runId), screenshot: { status: 'disabled', reason: 'Set MICROFIXD_ENABLE_LOCAL_SCREENSHOTS=true only in a trusted environment to permit local-console capture.' } });
      return;
    }
    const capture = await VisualSnapshotOrgan.captureLocalConsole(Number(process.env.PORT || 3000), process.env.ADMIN_API_KEY);
    await runtime.store.appendSystemEvent({ id: `screenshot-${Date.now()}`, eventName: 'local_console_screenshot_captured', organId: 'puppeteer-organ', runId, severity: 'info', fields: capture.metadata, createdAt: new Date().toISOString() });
    res.status(200).set('X-Microfixd-Governance', governance.outcome).set('X-Microfixd-Screenshot-Target', 'local-operations-console').type('image/png').send(capture.image);
  }));

  app.post('/api/autonomy/organs/:organId/invoke', asyncHandler(async (req, res) => {
    const operation = req.body?.operation;
    if (!['status', 'describe', 'prepare'].includes(operation)) {
      res.status(400).json({ error: 'operation must be status, describe, or prepare.' });
      return;
    }
    const result = await organs.invoke({ organId: req.params.organId, operation, runId: typeof req.body?.runId === 'string' ? req.body.runId : undefined, tenantId: tenantIdFrom(req), payload: isRecord(req.body?.payload) ? req.body.payload : {}, requestedBy: typeof req.body?.requestedBy === 'string' ? req.body.requestedBy : 'Craig' });
    res.status(result.outcome === 'allowed' ? 200 : result.outcome === 'awaiting_approval' ? 202 : 403).json(result);
  }));

  app.get('/api/autonomy/plugins', (_req, res) => {
    res.json({ plugins: registry.list(), authority: 'Paragon Dissector Tier-0' });
  });

  app.post('/api/autonomy/goals', asyncHandler(async (req, res) => {
    // Real meta-layer gate, not just a read-only report: a tenant
    // already in a degraded state (real anomalyScore >= 0.4, per
    // MetaAnalyzer) has new missions blocked here, not just observable
    // after the fact. This does not override Paragon's own approval
    // gates -- it's an additional, earlier check using data Paragon
    // doesn't itself compute (heap, wiring, drift, trust).
    const tenantId = tenantIdFrom(req);
    const assessment = await MetaAnalyzer.analyze(runtime.store, tenantId);
    if (assessment.degraded) {
      res.status(409).json({
        error: 'New missions are blocked while this tenant is in a degraded meta-layer state.',
        anomalyScore: assessment.anomalyScore,
        signals: assessment.signals,
        remediation: 'Review GET /api/autonomy/meta/analyze and POST /api/autonomy/meta/heal, or resolve the underlying condition, then retry.',
      });
      return;
    }
    const run = await runtime.submitGoal({
      goal: String(req.body?.goal || ''),
      agentId: typeof req.body?.agentId === 'string' ? req.body.agentId : undefined,
      tenantId,
      requestedBy: typeof req.body?.requestedBy === 'string' ? req.body.requestedBy : 'Craig',
      metadata: isRecord(req.body?.metadata) ? req.body.metadata : {},
    });
    res.status(202).json({ run, authority: 'Paragon Dissector Tier-0' });
  }));

  app.get('/api/autonomy/runs/:runId', asyncHandler(async (req, res) => {
    const detail = await runtime.getRunWithSteps(req.params.runId);
    if (!detail || detail.run.tenantId !== tenantIdFrom(req)) {
      res.status(404).json({ error: 'Run not found in the active tenant.' });
      return;
    }
    res.json(detail);
  }));

  // Mints a real, single-use, 60-second token so the browser's native
  // EventSource (which cannot set the x-microfixd-admin-key header) can
  // open the /stream route below with a real credential instead of the
  // raw admin key. This route itself still requires the real header.
  app.post('/api/autonomy/runs/:runId/stream-token', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const token = randomUUID();
    streamTokens.set(token, { tenantId, expires: Date.now() + 60_000 });
    res.json({ token, expiresInMs: 60_000 });
  }));

  // Real Server-Sent Events stream for a run. Replaces client-side
  // polling with an actual push transport, server-side -- it still reads
  // the same runtime.getRunWithSteps() the polling client used, just on
  // an internal interval, and pushes a diff-only frame whenever a step's
  // status actually changes. No data here is synthesized; an idle run
  // with unchanged steps sends nothing but keep-alive comments.
  app.get('/api/autonomy/runs/:runId/stream', asyncHandler(async (req, res) => {
    const tenantId = (req as Request & { streamTenantId?: string }).streamTenantId ?? tenantIdFrom(req);
    const detail = await runtime.getRunWithSteps(req.params.runId);
    if (!detail || detail.run.tenantId !== tenantId) {
      res.status(404).json({ error: 'Run not found in the active tenant.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const seen = new Map<string, string>();
    let closed = false;
    req.on('close', () => { closed = true; });

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('graph.started', { missionId: detail.run.id });

    const interval = setInterval(async () => {
      if (closed) { clearInterval(interval); return; }
      try {
        const current = await runtime.getRunWithSteps(req.params.runId);
        if (!current) { clearInterval(interval); res.end(); return; }
        for (const step of current.steps) {
          if (seen.get(step.id) !== step.status) {
            seen.set(step.id, step.status);
            send('graph.step', { missionId: current.run.id, stepId: step.id, sequence: step.sequence, status: step.status, action: step.action });
            if (step.status === 'blocked') send('approval.required', { missionId: current.run.id, stepId: step.id });
          }
        }
        if (['succeeded', 'failed', 'cancelled'].includes(current.run.status)) {
          send('mission.completed', { missionId: current.run.id, outcome: current.run.status, error: current.run.error });
          clearInterval(interval);
          res.end();
        } else {
          res.write(': keep-alive\n\n');
        }
      } catch (err) {
        send('system.error', { message: (err as Error).message });
      }
    }, 1000);

    req.on('close', () => clearInterval(interval));
  }));

  // Real ElevenLabs voice synthesis. Returns audio/mpeg bytes directly,
  // or a real error (missing key, upstream failure) with no fake audio
  // fallback -- the frontend is responsible for degrading to on-screen
  // text or browser TTS when this fails.
  app.post('/api/autonomy/voice/speak', asyncHandler(async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!text.trim()) { res.status(400).json({ error: 'Body must include non-empty text.' }); return; }
    try {
      const audio = await synthesizeSpeech(text, typeof req.body?.voiceId === 'string' ? req.body.voiceId : undefined);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(audio);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  }));

  // Real code generation, gated at 'operator' since it produces content a
  // caller might then write to disk via the file/sandbox routes. Calls
  // Groq directly -- see generate.ts for why the fabricated OmniRoute
  // path from the uploaded reference zip was deliberately not ported.
  app.post('/api/autonomy/generate', requireRole('operator'), asyncHandler(async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    if (!prompt.trim()) { res.status(400).json({ error: 'Body must include a non-empty prompt.' }); return; }
    const result = await generateFiles(prompt, req.body?.existingFiles);
    if (!result.success) { res.status(502).json(result); return; }
    res.json(result);
  }));

  app.post('/api/autonomy/runs/:runId/github-change', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'github-connector-organ', operation: 'prepare', runId: req.params.runId, tenantId, payload: { summary: req.body?.summary }, requestedBy: 'Craig' });
    if (governance.outcome !== 'allowed') { res.status(governance.outcome === 'awaiting_approval' ? 202 : 403).json({ governance }); return; }
    const request = await runtime.requestGithubChange(req.params.runId, tenantId, String(req.body?.summary || 'Governed source change request.'));
    if (!request) { res.status(404).json({ error: 'Run not found in the active tenant.' }); return; }
    res.status(202).json({ changeRequest: request, governance, boundary: 'This creates an audited request only. A registered GitHub plugin route and a separate Paragon/Craig approval are required before any PR, merge, CI/CD, or deployment action.' });
  }));

  app.get('/api/autonomy/runs/:runId/integration-audit', asyncHandler(async (req, res) => {
    const detail = await runtime.getRunWithSteps(req.params.runId);
    if (!detail || detail.run.tenantId !== tenantIdFrom(req)) { res.status(404).json({ error: 'Run not found in the active tenant.' }); return; }
    const limit = Math.max(1, Math.min(Number(req.query.limit || 100), 500));
    res.json({ audits: await runtime.store.listIntegrationAudits(req.params.runId, limit) });
  }));

  app.get('/api/autonomy/approvals', asyncHandler(async (req, res) => {
    const tenantId = tenantIdFrom(req);
    const status = typeof req.query.status === 'string' ? req.query.status as 'pending' | 'approved' | 'rejected' | 'expired' : undefined;
    const governance = await organs.invoke({ organId: 'tenant-registry', operation: 'status', tenantId, requestedBy: 'Craig' });
    res.json({ tenantId, approvals: await runtime.listApprovals(tenantId, status), governance });
  }));

  app.post('/api/autonomy/approvals/:approvalId/decision', requireRole('operator'), asyncHandler(async (req, res) => {
    if (typeof req.body?.approved !== 'boolean') {
      res.status(400).json({ error: 'approved must be a boolean.' });
      return;
    }
    const tenantId = tenantIdFrom(req);
    const governance = await organs.invoke({ organId: 'approval-control-organ', operation: 'prepare', tenantId, payload: { approvalId: req.params.approvalId, approved: req.body.approved }, requestedBy: String(req.body?.actor || 'Craig') });
    if (governance.outcome !== 'allowed') { res.status(governance.outcome === 'awaiting_approval' ? 202 : 403).json({ governance }); return; }
    const approval = await runtime.decideApproval(req.params.approvalId, req.body.approved, String(req.body?.note || ''), String(req.body?.actor || 'Craig'), tenantId);
    if (!approval) {
      res.status(404).json({ error: 'Approval not found.' });
      return;
    }
    res.json({ approval, governance });
  }));

  app.post('/api/autonomy/web/route', asyncHandler(async (req, res) => {
    const requiredFields = ['runId', 'stepId', 'pluginId', 'operation', 'path'];
    const missing = requiredFields.filter((field) => typeof req.body?.[field] !== 'string' || req.body[field].length === 0);
    if (missing.length > 0) { res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` }); return; }
    const detail = await runtime.getRunWithSteps(req.body.runId);
    if (!detail || detail.run.tenantId !== tenantIdFrom(req)) { res.status(404).json({ error: 'Run not found in the active tenant.' }); return; }
    const webGate = await organs.invoke({ organId: 'web-automation-organ', operation: 'prepare', runId: req.body.runId, tenantId: tenantIdFrom(req), payload: { pluginId: req.body.pluginId, operation: req.body.operation, path: req.body.path }, requestedBy: 'Craig' });
    if (webGate.outcome !== 'allowed') { res.status(webGate.outcome === 'awaiting_approval' ? 202 : 403).json({ governance: webGate }); return; }
    const result = await router.route(toRouterRequest(req.body));
    res.status(result.status === 'ok' ? 200 : result.status === 'awaiting_approval' ? 202 : result.status === 'blocked' ? 403 : 502).json({ ...result, governance: webGate });
  }));

  app.post('/api/autonomy/integrations/route', asyncHandler(async (req, res) => {
    const requiredFields = ['runId', 'stepId', 'pluginId', 'operation', 'path'];
    const missing = requiredFields.filter((field) => typeof req.body?.[field] !== 'string' || req.body[field].length === 0);
    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      return;
    }
    const detail = await runtime.getRunWithSteps(req.body.runId);
    if (!detail || detail.run.tenantId !== tenantIdFrom(req)) { res.status(404).json({ error: 'Run not found in the active tenant.' }); return; }
    const result = await router.route(toRouterRequest(req.body));
    res.status(result.status === 'ok' ? 200 : result.status === 'awaiting_approval' ? 202 : result.status === 'blocked' ? 403 : 502).json(result);
  }));
};

// Real, in-memory, short-lived stream tokens. A browser EventSource
// cannot set the x-microfixd-admin-key header, so the SSE route needs
// some other real credential. Rather than putting the actual admin key
// in a URL (which leaks into access logs and browser history), a
// properly-authenticated client first mints a random, 60-second,
// single-route token via POST (which DOES require the real header), then
// opens the EventSource with that token instead. This map resets on
// restart -- acceptable, since tokens are meant to be single-session and
// short-lived anyway, not a durable credential store.
export const streamTokens = new Map<string, { tenantId: string; expires: number }>();

// Real RBAC, scoped honestly: three roles (admin > operator > viewer),
// each bound to its own key via MICROFIXD_ROLE_KEYS (a JSON object,
// e.g. {"admin":"...","operator":"...","viewer":"..."}). ADMIN_API_KEY
// keeps working standalone as a full-admin key for backward
// compatibility -- setting it alone is equivalent to today's behavior.
//
// Scope of what's actually gated by role so far (see requireRole() call
// sites below): approval decisions, safe-mode toggle, GitHub export, and
// browser/sandbox execution require 'operator' or above. Every other
// /api/autonomy route still only requires "any valid key" exactly like
// before this change -- this is a real, working RBAC layer on the
// highest-consequence actions, not full per-route coverage yet.
type Role = 'admin' | 'operator' | 'viewer';
const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

const resolveRoleKeys = (): Partial<Record<Role, string>> => {
  const keys: Partial<Record<Role, string>> = {};
  if (process.env.ADMIN_API_KEY) keys.admin = process.env.ADMIN_API_KEY;
  const raw = process.env.MICROFIXD_ROLE_KEYS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const role of ['admin', 'operator', 'viewer'] as Role[]) {
        if (typeof parsed[role] === 'string' && parsed[role]) keys[role] = parsed[role];
      }
    } catch {
      // Malformed MICROFIXD_ROLE_KEYS is treated as "not configured" --
      // falls back to whatever ADMIN_API_KEY alone provides, never
      // silently grants access.
    }
  }
  return keys;
};

const timingSafeMatch = (candidate: string, expected: string): boolean => {
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer);
};

/** Attach the caller's resolved role (if any) to the request for downstream requireRole() checks. */
const resolveRole = (candidate: string): Role | null => {
  const keys = resolveRoleKeys();
  for (const role of ['admin', 'operator', 'viewer'] as Role[]) {
    const key = keys[role];
    if (key && timingSafeMatch(candidate, key)) return role;
  }
  return null;
};

/** Route-level gate: rejects if the caller's resolved role is below `minRole`. Must run after requireAdmin. */
const requireRole = (minRole: Role) => (req: Request, res: Response, next: NextFunction): void => {
  const role = (req as Request & { microfixdRole?: Role }).microfixdRole;
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    res.status(403).json({ error: `This action requires the '${minRole}' role or higher. Configure MICROFIXD_ROLE_KEYS to grant it.` });
    return;
  }
  next();
};

const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // DEV_AUTH_BYPASS: local-development convenience only. Hard-locked to
  // never fire when NODE_ENV is 'production' -- this check comes first
  // and cannot be reordered or overridden by any other env var,
  // including from a request. This bypasses the LOGIN check only. It
  // has no effect on approval-tiers.ts's propose/approve/consume cycle
  // for actual actions (writes, deploys, external effects) -- those
  // still require real approval regardless of this flag. Different
  // mechanism, different risk, intentionally not connected.
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'DEV_AUTH_BYPASS is set but NODE_ENV=production -- refusing to bypass auth in what claims to be a production environment. Unset DEV_AUTH_BYPASS or fix NODE_ENV.' });
      return;
    }
    (req as Request & { microfixdRole?: Role }).microfixdRole = 'admin';
    next();
    return;
  }

  const configured = process.env.ADMIN_API_KEY;
  if (!configured) {
    res.status(503).json({ error: 'ADMIN_API_KEY must be configured before privileged Microfixd routes are enabled.' });
    return;
  }
  const expires = process.env.ADMIN_API_KEY_EXPIRES;
  if (expires && Number.isFinite(Date.parse(expires)) && Date.now() > Date.parse(expires)) {
    res.status(401).json({ error: 'The configured admin key has expired (ADMIN_API_KEY_EXPIRES). Rotate ADMIN_API_KEY in your deployment environment before continuing.' });
    return;
  }

  // Narrow exception: only the SSE stream route, and only with a
  // still-valid, previously-minted token. Every other /api/autonomy
  // route is unaffected and still requires the real header.
  if (req.path.endsWith('/stream') && typeof req.query.token === 'string') {
    const entry = streamTokens.get(req.query.token);
    if (entry && entry.expires > Date.now()) {
      streamTokens.delete(req.query.token); // single-use
      (req as Request & { streamTenantId?: string; microfixdRole?: Role }).streamTenantId = entry.tenantId;
      (req as Request & { microfixdRole?: Role }).microfixdRole = 'viewer';
      next();
      return;
    }
    res.status(401).json({ error: 'Stream token invalid or expired.' });
    return;
  }

  const candidate = req.header('x-microfixd-admin-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '') || '';
  // Backward-compatible full check against ADMIN_API_KEY (unchanged
  // behavior for anyone only using that one key).
  if (timingSafeMatch(candidate, configured)) {
    (req as Request & { microfixdRole?: Role }).microfixdRole = 'admin';
    next();
    return;
  }
  // New: also accept operator/viewer keys from MICROFIXD_ROLE_KEYS.
  const role = resolveRole(candidate);
  if (role) {
    (req as Request & { microfixdRole?: Role }).microfixdRole = role;
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized.' });
};

const asyncHandler = (handler: (req: Request, res: Response) => Promise<void>): ((req: Request, res: Response, next: NextFunction) => void) =>
  (req, res, next) => { void handler(req, res).catch(next); };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const tenantIdFrom = (req: Request): string => {
  const value = String(req.header('x-microfixd-tenant') || req.body?.tenantId || req.query?.tenantId || 'global').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new Error('Tenant Isolation Guard rejected the tenant identifier.');
  return value;
};

const toRouterRequest = (body: Record<string, any>): RouterRequest => ({
  runId: body.runId,
  stepId: body.stepId,
  pluginId: body.pluginId,
  operation: body.operation,
  path: body.path,
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(body?.method) ? body.method : 'GET',
  query: isRecord(body?.query) ? body.query as Record<string, string | number | boolean | undefined> : undefined,
  body: isRecord(body?.body) ? body.body : undefined,
  headers: isRecord(body?.headers) ? Object.fromEntries(Object.entries(body.headers).filter(([, value]) => typeof value === 'string')) as Record<string, string> : undefined,
  cacheTtlSeconds: Number.isFinite(body?.cacheTtlSeconds) ? Math.max(0, Math.min(Number(body.cacheTtlSeconds), 86_400)) : 0,
  retrySafe: body?.retrySafe === true,
});

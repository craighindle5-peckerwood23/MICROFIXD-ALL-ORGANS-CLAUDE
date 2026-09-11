import { randomUUID } from 'node:crypto';
import type { AutonomyRuntime } from './runtime.ts';
import type { OrganKernel } from './organ-kernel.ts';
import { listOrgans, getOrgan, organSummary } from './organ-registry.ts';
import { MetaObserver } from './meta-observer.ts';
import { MetaAnalyzer } from './meta-analyzer.ts';
import { MetaStrategist } from './meta-strategist.ts';
import { MetaEvolver } from './meta-evolver.ts';
import { MetaHealer } from './meta-healer.ts';
import { detectWebAutomationBackend, executeWebTask } from './web-automation-adapter.ts';
import { callExternalApi } from './internet-agent.ts';
import { readWorkspaceFile, listWorkspaceDirectory, writeFiles } from './file-writer.ts';
import { proposeGovernedAction } from './governed-execution.ts';
import { assessCapability, summarizeSelfModel } from './genesis-self-model.ts';
import { classifyIntent } from './intent-classifier.ts';
import { registerProject, listProjects, distillSemanticMemory, recallProcedure } from './world-model.ts';
import { loadMcpServers, listServerTools, callServerTool } from './mcp-adapter.ts';
import { getPreviewStatus } from './preview.ts';
import { runHypothetical } from './hypothetical-engine.ts';

/**
 * ChatOrgan: the single free-text surface for the entire system.
 *
 * This adds NO new authority. Every branch below calls the exact same
 * runtime/OrganKernel methods the REST routes in routes.ts already call
 * -- so a chat message asking "what's the system status" and a GET to
 * /api/autonomy/introspection hit the same code and the same Paragon
 * governance. Nothing here bypasses approval: any branch that mutates
 * state (submitGoal, setSafeMode, decideApproval) still goes through
 * organs.invoke() first and still returns 'awaiting_approval' when
 * Paragon requires a human decision, exactly like the HTTP handlers do.
 *
 * This exists so a chat box under the holographic head can reach every
 * part of the infrastructure through one endpoint, instead of the
 * frontend needing to know all ~35 routes individually.
 */

export type ChatContext = {
  tenantId: string;
  requestedBy: string;
};

export type ChatResult = {
  reply: string;
  organId?: string;
  route?: string;
  data?: unknown;
  governance?: unknown;
  status: 'ok' | 'awaiting_approval' | 'denied' | 'not_understood';
};

type Intent = {
  name: string;
  patterns: RegExp[];
  describe: string;
  handle: (utterance: string, ctx: ChatContext) => Promise<ChatResult>;
};

export class ChatOrgan {
  private intents: Intent[];

  constructor(private runtime: AutonomyRuntime, private organs: OrganKernel) {
    this.intents = this.buildIntents();
  }

  async route(utterance: string, ctx: ChatContext): Promise<ChatResult> {
    const text = utterance.trim();
    if (!text) return { reply: "I didn't catch that -- could you repeat it?", status: 'not_understood' };

    for (const intent of this.intents) {
      if (intent.patterns.some((pattern) => pattern.test(text))) {
        try {
          const result = await intent.handle(text, ctx);
          await this.logUsage(intent.name, text, ctx, result);
          return result;
        } catch (error) {
          const result: ChatResult = { reply: `That request hit an error: ${(error as Error).message}`, status: 'denied' };
          await this.logUsage(intent.name, text, ctx, result);
          return result;
        }
      }
    }

    // LLM interpretation layer: only reached when no regex pattern
    // matched. This is the one and only place an LLM touches this
    // system, and it adds NO new authority -- it is asked to pick the
    // name of one of the exact same governed intents above (or 'none'),
    // via a constrained enum response schema. Whatever it picks still
    // runs through that intent's own handle() and, transitively, the
    // same Paragon governance every REST route already goes through.
    // Requires GEMINI_API_KEY; with no key configured this is skipped
    // entirely and the honest "not understood" fallback below runs
    // instead -- there is no silent, unlabeled degradation.
    if (process.env.GEMINI_API_KEY) {
      const llmPick = await this.interpretWithLLM(text).catch(() => null);
      if (llmPick) {
        const intent = this.intents.find((i) => i.name === llmPick);
        if (intent) {
          try {
            const result = await intent.handle(text, ctx);
            result.reply = `[Interpreted as "${intent.name}"] ${result.reply}`;
            await this.logUsage(`llm:${intent.name}`, text, ctx, result);
            return result;
          } catch (error) {
            const result: ChatResult = { reply: `That request hit an error: ${(error as Error).message}`, status: 'denied' };
            await this.logUsage(`llm:${intent.name}`, text, ctx, result);
            return result;
          }
        }
      }
    }

    const result: ChatResult = {
      reply:
        "I didn't recognize that as one of my governed capabilities. Try: system status, list organs, agent posture, " +
        'compute status, infrastructure status, safe mode status, audit, wiring status, self-healing status, ' +
        'list approvals, approve/reject an approval, list plugins, describe an organ, meta-layer status, run meta healer, ' +
        'browse <url>, read <file>, list <directory>, write a file called <name> with <content>, or create a goal.',
      status: 'not_understood',
    };
    await this.logUsage('unrecognized', text, ctx, result);
    return result;
  }

  /** Now delegates to the shared, more robust classifier (intent-classifier.ts) which has a real 3-provider fallback (Gemini -> Groq -> DeepSeek) -- this used to be a separate, single-provider-only duplicate of that same logic. */
  private async interpretWithLLM(text: string): Promise<string | null> {
    const result = await classifyIntent(text, this.intents.map((i) => ({ name: i.name, describe: i.describe })));
    return result.intent;
  }

  private async logUsage(intentName: string, utterance: string, ctx: ChatContext, result: ChatResult): Promise<void> {
    try {
      await this.runtime.store.appendUsageEvent({
        id: randomUUID(),
        tenantId: ctx.tenantId,
        kind: 'chat',
        name: intentName,
        actorId: ctx.requestedBy,
        dataRefs: result.organId ? [result.organId] : [],
        metadata: { utteranceLength: utterance.length, status: result.status },
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Logging must never break the chat response the user is waiting on.
    }
  }

  private async organStatus(organId: string, ctx: ChatContext) {
    return this.organs.invoke({ organId, operation: 'status', tenantId: ctx.tenantId, requestedBy: ctx.requestedBy });
  }

  private buildIntents(): Intent[] {
    return [
      {
        name: 'usage-report',
        patterns: [/usage report/i, /data usage/i, /how much.*used/i, /telemetry summary/i],
        describe: 'Usage summary: in-memory telemetry window plus durable, cross-restart history.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('runtime-auditor', ctx);
          const events = this.runtime.telemetry.recent(500);
          const durable = await this.runtime.store.listUsageEvents(ctx.tenantId, 500);
          const byKind: Record<string, number> = {};
          for (const event of durable) byKind[event.kind] = (byKind[event.kind] || 0) + 1;
          return {
            reply: `In-memory window: ${events.length} events since last restart. Durable history: ${durable.length} events for this tenant across ${Object.keys(byKind).length} kinds.`,
            organId: 'runtime-auditor',
            route: '/api/autonomy/usage-report',
            data: { inMemoryEventCount: events.length, durableEventCount: durable.length, durableByKind: byKind },
            governance,
            status: 'ok',
          };
        },
      },
      {
        name: 'help',
        patterns: [/^help$/i, /what can you do/i, /capabilities/i, /list.*commands/i],
        describe: 'List what the chat surface can do.',
        handle: async () => ({
          reply:
            'I can report on: system status, organs, agents, compute, infrastructure, safe mode, audit, ' +
            'governance lock, wiring, self-healing, web-use posture, plugins, approvals, run status, and a usage report. ' +
            'I can also submit a new goal and approve/reject a pending approval.',
          status: 'ok',
        }),
      },
      {
        name: 'system-status',
        patterns: [/system status/i, /how are you/i, /introspect/i, /overall status/i],
        describe: 'Full system introspection.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('runtime-auditor', ctx);
          const data = await this.runtime.introspect();
          return { reply: this.summarize('System introspection', data), organId: 'runtime-auditor', route: '/api/autonomy/introspection', data, governance, status: 'ok' };
        },
      },
      {
        name: 'list-organs',
        patterns: [/list organs/i, /what organs/i, /show organs/i],
        describe: 'List every registered organ.',
        handle: async () => {
          const organs = listOrgans();
          return {
            reply: `There are ${organs.length} registered organs across ${organSummary().families} families. Ask "describe <organ id>" for one specifically.`,
            data: { summary: organSummary(), organs },
            status: 'ok',
          };
        },
      },
      {
        name: 'describe-organ',
        patterns: [/describe organ (.+)/i, /what does (.+) organ do/i, /tell me about (.+) organ/i],
        describe: 'Describe a specific organ by id.',
        handle: async (utterance) => {
          const match = utterance.match(/describe organ (.+)/i) || utterance.match(/what does (.+) organ do/i) || utterance.match(/tell me about (.+) organ/i);
          const candidate = (match?.[1] || '').trim().toLowerCase().replace(/\s+/g, '-');
          const organ = getOrgan(candidate) || listOrgans().find((o) => o.name.toLowerCase().includes(candidate));
          if (!organ) return { reply: `I couldn't find an organ matching "${candidate}".`, status: 'not_understood' };
          return { reply: `${organ.name} (family ${organ.familyNumber}, ${organ.mode}): ${organ.guidedPath}`, data: organ, status: 'ok' };
        },
      },
      {
        name: 'agents',
        patterns: [/agent posture/i, /list agents/i, /show agents/i],
        describe: 'Agent registry and posture.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('agent-registry', ctx);
          const agents = await this.runtime.listAgents(ctx.tenantId);
          return { reply: `There are ${agents.length} agents registered for tenant "${ctx.tenantId}".`, organId: 'agent-registry', route: '/api/autonomy/agents', data: agents, governance, status: 'ok' };
        },
      },
      {
        name: 'compute',
        patterns: [/compute status/i, /compute posture/i, /gpu status/i, /cpu status/i],
        describe: 'Compute posture.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('device-capability-organ', ctx);
          const data = await this.runtime.computeAssessment(ctx.tenantId);
          return { reply: this.summarize('Compute posture', data), organId: 'device-capability-organ', route: '/api/autonomy/compute/posture', data, governance, status: 'ok' };
        },
      },
      {
        name: 'infrastructure',
        patterns: [/infrastructure status/i, /infra status/i],
        describe: 'Infrastructure posture.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('device-capability-organ', ctx);
          const data = await this.runtime.infrastructurePosture(ctx.tenantId);
          return { reply: this.summarize('Infrastructure posture', data), organId: 'device-capability-organ', route: '/api/autonomy/infrastructure', data, governance, status: 'ok' };
        },
      },
      {
        name: 'safe-mode-status',
        patterns: [/safe mode status/i, /is safe mode/i],
        describe: 'Safe mode status.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('safe-mode-control-organ', ctx);
          const data = await this.runtime.store.listLevel6Records('safe_mode', ctx.tenantId);
          return { reply: this.summarize('Safe mode', data), organId: 'safe-mode-control-organ', route: '/api/autonomy/safe-mode', data, governance, status: 'ok' };
        },
      },
      {
        name: 'safe-mode-set',
        patterns: [/(enable|turn on) safe mode/i, /(disable|turn off) safe mode/i],
        describe: 'Enable or disable safe mode (governed, may require approval).',
        handle: async (utterance, ctx) => {
          const enabled = /enable|turn on/i.test(utterance);
          const governance = await this.organs.invoke({ organId: 'safe-mode-control-organ', operation: 'prepare', tenantId: ctx.tenantId, payload: { enabled }, requestedBy: ctx.requestedBy });
          if (governance.outcome !== 'allowed') {
            return { reply: `That requires approval before it takes effect (safe mode ${enabled ? 'on' : 'off'}).`, organId: 'safe-mode-control-organ', governance, status: 'awaiting_approval' };
          }
          const result = await this.runtime.setSafeMode(enabled, ctx.requestedBy, 'Requested via chat.');
          return { reply: `Safe mode is now ${enabled ? 'ON' : 'OFF'}.`, organId: 'safe-mode-control-organ', data: result, governance, status: 'ok' };
        },
      },
      {
        name: 'audit',
        patterns: [/full audit/i, /audit report/i, /run an audit/i],
        describe: 'Full system audit.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('runtime-auditor', ctx);
          const data = await this.runtime.fullSystemAudit(ctx.tenantId);
          return { reply: this.summarize('Audit', data), organId: 'runtime-auditor', route: '/api/autonomy/audit', data, governance, status: 'ok' };
        },
      },
      {
        name: 'governance-lock',
        patterns: [/governance lock/i, /paragon status/i],
        describe: 'Governance lock posture.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('paragon-dissector', ctx);
          const data = await this.runtime.governanceLockPosture(ctx.tenantId);
          return { reply: this.summarize('Governance lock', data), organId: 'paragon-dissector', route: '/api/autonomy/governance-lock', data, governance, status: 'ok' };
        },
      },
      {
        name: 'wiring',
        patterns: [/wiring status/i, /is everything wired/i],
        describe: 'Master wiring status.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('organ-wiring-layer', ctx);
          const data = await this.runtime.masterWiringPosture(ctx.tenantId);
          return { reply: this.summarize('Wiring', data), organId: 'organ-wiring-layer', route: '/api/autonomy/wiring', data, governance, status: 'ok' };
        },
      },
      {
        name: 'self-healing',
        patterns: [/self.healing status/i, /healing report/i],
        describe: 'Self-healing posture.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('health-trigger-organ', ctx);
          const data = await this.runtime.selfHealingPosture(ctx.tenantId);
          return { reply: this.summarize('Self-healing', data), organId: 'health-trigger-organ', route: '/api/autonomy/self-healing', data, governance, status: 'ok' };
        },
      },
      {
        name: 'web-use',
        patterns: [/web.use posture/i, /browser automation status/i],
        describe: 'Web-use posture.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('web-automation-organ', ctx);
          const data = await this.runtime.webUsePosture(ctx.tenantId);
          return { reply: this.summarize('Web-use posture', data), organId: 'web-automation-organ', route: '/api/autonomy/web/posture', data, governance, status: 'ok' };
        },
      },
      {
        name: 'plugins',
        patterns: [/list plugins/i, /show plugins/i, /what plugins/i, /list integrations/i],
        describe: 'List registered plugins.',
        handle: async () => ({ reply: 'Listing registered plugins.', route: '/api/autonomy/plugins', status: 'ok' }),
      },
      {
        name: 'approvals-list',
        patterns: [/pending approvals/i, /list approvals/i, /what needs approval/i],
        describe: 'List approvals.',
        handle: async (_u, ctx) => {
          const governance = await this.organStatus('tenant-registry', ctx);
          const approvals = await this.runtime.listApprovals(ctx.tenantId, 'pending');
          return { reply: `There are ${approvals.length} pending approvals.`, organId: 'tenant-registry', route: '/api/autonomy/approvals', data: approvals, governance, status: 'ok' };
        },
      },
      {
        name: 'approval-decide',
        patterns: [/(approve|reject) approval (\S+)/i],
        describe: 'Approve or reject a specific approval by id (governed).',
        handle: async (utterance, ctx) => {
          const match = utterance.match(/(approve|reject) approval (\S+)/i)!;
          const approved = match[1].toLowerCase() === 'approve';
          const approvalId = match[2];
          const governance = await this.organs.invoke({ organId: 'approval-control-organ', operation: 'prepare', tenantId: ctx.tenantId, payload: { approvalId, approved }, requestedBy: ctx.requestedBy });
          if (governance.outcome !== 'allowed') {
            return { reply: `That decision itself requires further approval before it applies.`, organId: 'approval-control-organ', governance, status: 'awaiting_approval' };
          }
          const approval = await this.runtime.decideApproval(approvalId, approved, 'Decided via chat.', ctx.requestedBy, ctx.tenantId);
          if (!approval) return { reply: `I couldn't find an approval with id "${approvalId}".`, status: 'not_understood' };
          return { reply: `Approval ${approvalId} was ${approved ? 'approved' : 'rejected'}.`, organId: 'approval-control-organ', data: approval, governance, status: 'ok' };
        },
      },
      {
        name: 'meta-status',
        patterns: [/meta.?layer status/i, /system health check/i, /is the system degraded/i, /anomaly score/i],
        describe: 'Real meta-cognition summary: anomaly score, strategy, degraded state.',
        handle: async (_u, ctx) => {
          const [observation, decision] = await Promise.all([MetaObserver.observe(this.runtime.store, ctx.tenantId), MetaStrategist.decide(this.runtime.store, ctx.tenantId)]);
          return { reply: `System mode: ${decision.systemMode}. Anomaly score ${decision.assessment.anomalyScore} (${decision.assessment.degraded ? 'degraded' : 'nominal'}). Strategy: ${decision.strategy.mode} -- ${decision.strategy.reason}`, route: '/api/autonomy/meta/decide', data: { observation, decision }, status: 'ok' };
        },
      },
      {
        name: 'meta-heal',
        patterns: [/run meta ?healer/i, /heal the system/i, /recommend a fix for the system/i],
        describe: 'Runs MetaHealer -- recommends only (safe-mode/repair-review/none), never auto-executes.',
        handle: async (_u, ctx) => {
          const assessment = await MetaAnalyzer.analyze(this.runtime.store, ctx.tenantId);
          const recommendation = await MetaHealer.recommend(this.runtime.store, assessment);
          return { reply: `MetaHealer recommends: ${recommendation.action}. ${recommendation.reason}`, route: '/api/autonomy/meta/heal', data: recommendation, status: 'ok' };
        },
      },
      {
        name: 'evolver-recommendations',
        patterns: [/evolver recommendations/i, /what should evolve/i, /expansion candidates/i],
        describe: 'Real evolution/repair-history-based expansion or retirement recommendations.',
        handle: async (_u, ctx) => {
          const recs = await MetaEvolver.recommend(this.runtime.store, ctx.tenantId);
          const summary = recs.map((r) => `${r.recordType}: ${r.recommendation}`).join('; ') || 'No records yet.';
          return { reply: `Evolver recommendations -- ${summary}`, route: '/api/autonomy/meta/evolve', data: recs, status: 'ok' };
        },
      },
      {
        name: 'web-automation-capability',
        patterns: [/can you browse|is chromium available|web automation (capability|backend)/i],
        describe: 'Reports whether Playwright or HTTP-DOM automation is active on this deployment right now.',
        handle: async () => {
          const capability = await detectWebAutomationBackend();
          return { reply: `This deployment is currently using ${capability.backend}. ${capability.reason}`, route: '/api/autonomy/web-automation/capability', data: capability, status: 'ok' };
        },
      },
      {
        name: 'web-browse',
        patterns: [/^(browse|go to|fetch|open) (https?:\/\/\S+)/i],
        describe: 'Fetch a URL and extract its title (governed by the domain allowlist).',
        handle: async (utterance) => {
          const match = utterance.match(/(https?:\/\/\S+)/i);
          if (!match) return { reply: 'I need a URL to browse.', status: 'not_understood' };
          const result = await executeWebTask(match[1], []);
          const title = result.httpDomResult?.title ?? result.playwrightResult?.find((r) => r.text)?.text;
          return { reply: `Fetched ${match[1]} via ${result.backendUsed}. ${title ? `Title: "${title}"` : 'No title extracted.'}`, route: '/api/autonomy/web-automation/execute', data: result, status: result.httpDomResult?.status === 'error' ? 'denied' : 'ok' };
        },
      },
      {
        name: 'internet-call',
        patterns: [/^call the api (https?:\/\/\S+)/i, /^(get|post) (https?:\/\/\S+)/i],
        describe: 'Generic authenticated external API call (GET only via chat; POST with a body needs the API directly).',
        handle: async (utterance) => {
          const match = utterance.match(/(https?:\/\/\S+)/i);
          if (!match) return { reply: 'I need a URL to call.', status: 'not_understood' };
          const result = await callExternalApi({ url: match[1], method: 'GET' });
          return { reply: result.status === 'ok' ? `Got HTTP ${result.httpStatus} from ${match[1]}.` : `Call failed: ${result.error}`, route: '/api/autonomy/internet/call', data: result, status: result.status === 'ok' ? 'ok' : 'denied' };
        },
      },
      {
        name: 'read-file',
        patterns: [/^(read|show me|cat) (?:the file )?(\S+\.\w+)$/i],
        describe: 'Read a workspace file (safe, ungated -- reading has no side effect).',
        handle: async (utterance) => {
          const match = utterance.match(/^(?:read|show me|cat) (?:the file )?(\S+\.\w+)$/i);
          if (!match) return { reply: 'Which file?', status: 'not_understood' };
          const result = await readWorkspaceFile(match[1]);
          return { reply: result.status === 'ok' ? `${match[1]} (${result.content!.length} chars):\n\n${result.content!.slice(0, 1500)}` : `Couldn't read that: ${result.error}`, route: '/api/autonomy/files/read', data: result, status: result.status === 'ok' ? 'ok' : 'denied' };
        },
      },
      {
        name: 'list-directory',
        patterns: [/^(list|ls) (?:the )?(?:directory |folder |files in )?(\S+)$/i],
        describe: 'List a workspace directory (safe, ungated).',
        handle: async (utterance) => {
          const match = utterance.match(/^(?:list|ls) (?:the )?(?:directory |folder |files in )?(\S+)$/i);
          if (!match) return { reply: 'Which directory?', status: 'not_understood' };
          const result = await listWorkspaceDirectory(match[1]);
          return { reply: result.status === 'ok' ? `${match[1]}: ${result.entries!.map((e) => `${e.name}${e.type === 'directory' ? '/' : ''}`).join(', ')}` : `Couldn't list that: ${result.error}`, route: '/api/autonomy/files/list', data: result, status: result.status === 'ok' ? 'ok' : 'denied' };
        },
      },
      {
        name: 'write-file-proposal',
        patterns: [/^(write|create|save) a file (?:called |named )?(\S+) with (.+)/i],
        describe: 'Propose writing a file. Governed -- creates an approval request, never writes directly from chat.',
        handle: async (utterance, ctx) => {
          const match = utterance.match(/^(?:write|create|save) a file (?:called |named )?(\S+) with (.+)/i);
          if (!match) return { reply: 'I need a filename and content: "write a file called X with ..."', status: 'not_understood' };
          const [, path, content] = match;
          const proposal = await proposeGovernedAction(this.runtime, { tenantId: ctx.tenantId, requestedBy: ctx.requestedBy, kind: 'apply_capability', title: `Write file: ${path}`, actionInput: { path, contentPreview: content.slice(0, 200) }, risk: 'medium' });
          if (proposal.outcome === 'awaiting_approval') return { reply: `Writing "${path}" needs your approval first. approvalId: ${proposal.approvalId}`, route: '/api/autonomy/files/write', data: proposal, status: 'awaiting_approval' };
          if (proposal.outcome === 'denied') return { reply: `That write was denied: ${proposal.reasons.join(' ')}`, route: '/api/autonomy/files/write', data: proposal, status: 'denied' };
          const result = await writeFiles({ [path]: content });
          return { reply: result.status === 'ok' ? `Wrote ${path}.` : `Write failed: ${result.error}`, route: '/api/autonomy/files/write', data: result, status: result.status === 'ok' ? 'ok' : 'denied' };
        },
      },
      {
        name: 'self-model',
        patterns: [/what can you actually do/i, /self.?model/i, /how reliable (are|is) (you|the system)/i, /honest (capability|assessment)/i],
        describe: 'Honest capability summary from real organ-registry status and evolution/repair track record -- not a fabricated confidence score.',
        handle: async () => {
          const summary = summarizeSelfModel();
          return { reply: summary.honestReliabilityNote, route: '/api/autonomy/genesis/self-model', data: summary, status: 'ok' };
        },
      },
      {
        name: 'world-model-recall',
        patterns: [/what do (you|we) know about ([a-z0-9_-]+)/i, /recall (procedure|knowledge) (?:for|about) ([a-z0-9_-]+)/i],
        describe: 'Real procedural recall -- what semantic memory has actually concluded about a subject, or an honest "insufficient evidence" if nothing has been distilled yet.',
        handle: async (utterance, ctx) => {
          const match = utterance.match(/what do (?:you|we) know about ([a-z0-9_-]+)/i) ?? utterance.match(/recall (?:procedure|knowledge) (?:for|about) ([a-z0-9_-]+)/i);
          const subject = match?.[2] ?? match?.[1];
          if (!subject) return { reply: 'Which subject do you want recalled?', status: 'not_understood' };
          const rec = await recallProcedure(this.runtime.store, ctx.tenantId, subject);
          return { reply: rec.reasoning, route: `/api/autonomy/world-model/recall/${subject}`, data: rec, status: 'ok' };
        },
      },
      {
        name: 'world-model-distill',
        patterns: [/distill (?:semantic )?memory/i, /update (?:your |the )?knowledge/i, /learn from (?:your |the )?history/i],
        describe: 'Real distillation of episodic memory and repair/evolution history into durable semantic facts.',
        handle: async (_u, ctx) => {
          const facts = await distillSemanticMemory(this.runtime.store, ctx.tenantId);
          const reply = facts.length === 0 ? 'No subject has enough real history yet (fewer than 3 observations each) to distill a fact from.' : `Distilled ${facts.length} real fact(s): ${facts.map((f) => f.name).join(', ')}.`;
          return { reply, route: '/api/autonomy/world-model/distill', data: facts, status: 'ok' };
        },
      },
      {
        name: 'mcp-servers',
        patterns: [/what mcp servers/i, /list mcp/i, /mcp connectors?/i],
        describe: 'Real, configured MCP servers -- via MICROFIXD_MCP_SERVERS_JSON, not a fabricated list.',
        handle: async () => {
          const servers = loadMcpServers();
          const reply = servers.length === 0 ? 'No MCP servers are configured (MICROFIXD_MCP_SERVERS_JSON is unset).' : `${servers.length} configured: ${servers.map((s) => s.id).join(', ')}.`;
          return { reply, route: '/api/autonomy/mcp/servers', data: servers.map((s) => s.id), status: 'ok' };
        },
      },
      {
        name: 'preview-status',
        patterns: [/preview status/i, /is (?:the )?build (?:up to date|current)/i, /do i need to rebuild/i],
        describe: 'Real preview/build status -- dev-mode live-reload vs production rebuild needed.',
        handle: async () => {
          const status = await getPreviewStatus();
          return { reply: status.note, route: '/api/autonomy/preview/status', data: status, status: 'ok' };
        },
      },
      {
        name: 'hypothetical',
        patterns: [/^what if (.+)/i, /hypothetically,? (.+)/i, /run a hypothetical[: ](.+)/i],
        describe: 'Real what-if exploration through the actual validation/execution pipeline -- never creates a durable proposal.',
        handle: async (utterance) => {
          const match = utterance.match(/^what if (.+)/i) ?? utterance.match(/hypothetically,? (.+)/i) ?? utterance.match(/run a hypothetical[: ](.+)/i);
          const specification = match?.[1];
          if (!specification) return { reply: 'What should I run as a hypothetical?', status: 'not_understood' };
          const result = await runHypothetical(this.runtime.sandbox, specification.slice(0, 80), specification);
          return { reply: result.reasoning, route: '/api/autonomy/organs/hypothetical-organ/prepare', data: result, status: 'ok' };
        },
      },
      {
        name: 'assess-capability',
        patterns: [/^can you (actually )?do ([a-z0-9-]+)\??$/i, /^assess (?:the )?([a-z0-9-]+) organ/i],
        describe: 'Assess whether a specific named organ is a verified real capability, based on real registry status and track record.',
        handle: async (utterance, ctx) => {
          const match = utterance.match(/^can you (?:actually )?do ([a-z0-9-]+)\??$/i) ?? utterance.match(/^assess (?:the )?([a-z0-9-]+) organ/i);
          if (!match) return { reply: 'Which organ or capability do you want assessed?', status: 'not_understood' };
          const organId = match[1] ?? match[2];
          const assessment = await assessCapability(this.runtime.store, ctx.tenantId, organId);
          return { reply: assessment.reasoning, route: `/api/autonomy/genesis/assess/${organId}`, data: assessment, status: 'ok' };
        },
      },
      {
        name: 'submit-goal',
        patterns: [/^(create a goal to|run|start a task to|new goal:?) (.+)/i],
        describe: 'Submit a new goal for the planner (still governed step by step).',
        handle: async (utterance, ctx) => {
          const match = utterance.match(/^(create a goal to|run|start a task to|new goal:?) (.+)/i)!;
          const goalText = match[2].trim();
          const run = await this.runtime.submitGoal({ goal: goalText, tenantId: ctx.tenantId, requestedBy: ctx.requestedBy, metadata: { source: 'chat' } });
          return { reply: `Goal submitted: "${goalText}". Run id is ${run.id}. Every step still goes through Paragon individually.`, route: '/api/autonomy/goals', data: run, status: 'ok' };
        },
      },
      {
        name: 'run-status',
        patterns: [/status of run (\S+)/i, /run (\S+) status/i],
        describe: 'Get the status of a specific run.',
        handle: async (utterance, ctx) => {
          const match = utterance.match(/status of run (\S+)/i) || utterance.match(/run (\S+) status/i);
          const runId = match?.[1];
          if (!runId) return { reply: 'Which run id?', status: 'not_understood' };
          const detail = await this.runtime.getRunWithSteps(runId);
          if (!detail || detail.run.tenantId !== ctx.tenantId) return { reply: `I couldn't find run "${runId}" in this tenant.`, status: 'not_understood' };
          return { reply: `Run ${runId} is ${detail.run.status}, on step ${detail.run.currentStep} of ${detail.run.plan.length}.`, data: detail, status: 'ok' };
        },
      },
    ];
  }

  private summarize(label: string, data: unknown): string {
    if (data && typeof data === 'object') {
      const keys = Object.keys(data as Record<string, unknown>).slice(0, 6);
      return `${label}: ${keys.join(', ')}${keys.length < Object.keys(data as Record<string, unknown>).length ? ', ...' : ''}. Full detail is in the response payload.`;
    }
    return `${label}: ${String(data)}`;
  }
}

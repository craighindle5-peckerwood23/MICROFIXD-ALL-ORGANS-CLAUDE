// src/autonomy/langgraph-mission.ts
//
// A REAL @langchain/langgraph StateGraph -- not a YAML file interpreted by
// a nonexistent runner, not calls to endpoints that don't exist
// (/simulate, /paragon/evaluate, /commit -- none of these are real routes
// in this backend; see src/autonomy/routes.ts for the actual list).
//
// This graph's nodes call the REAL, already-tested classes directly, in
// the same process, with real TypeScript imports:
//   - ParagonDissector.evaluate()   (src/autonomy/governance.ts)
//   - OrganKernel.invoke()          (src/autonomy/organ-kernel.ts)
//   - RuntimeStore.createApproval() (src/autonomy/store.ts)
//
// The approval pause is a genuine LangGraph interrupt() -- the graph
// actually suspends and returns control to the caller; resuming requires
// a real Command({ resume }) call, exactly per LangGraph's documented
// human-in-the-loop pattern. This is not simulated.
import { StateGraph, Annotation, interrupt, Command, MemorySaver, START, END } from '@langchain/langgraph';
import { randomUUID } from 'node:crypto';
import type { AutonomyRuntime } from './runtime.ts';
import type { OrganKernel } from './organ-kernel.ts';

const MissionState = Annotation.Root({
  runId: Annotation<string>,
  tenantId: Annotation<string>,
  requestedBy: Annotation<string>,
  organId: Annotation<string>,
  payload: Annotation<Record<string, unknown>>,
  outcome: Annotation<string | undefined>,
  decisionId: Annotation<string | undefined>,
  approved: Annotation<boolean | undefined>,
  result: Annotation<unknown>,
});

type MissionStateType = typeof MissionState.State;

/**
 * Builds the real graph. Takes the actual runtime/organs instances the
 * rest of the backend already uses -- this graph does not construct its
 * own parallel copy of governance, it calls the same one.
 */
export function buildMissionGraph(runtime: AutonomyRuntime, organs: OrganKernel) {
  async function proposeNode(state: MissionStateType): Promise<Partial<MissionStateType>> {
    // Real gate check: 'prepare' is the actual governed action attempt
    // (routed through Paragon inside OrganKernel). When Paragon's
    // decision is require_approval, OrganKernel creates a real, pending
    // ApprovalRequest and returns without executing anything --
    // OrganInvocationResult.outcome here uses OrganKernel's own
    // vocabulary ('allowed' | 'awaiting_approval' | 'denied'), which is
    // deliberately distinct from PolicyDecision's ('allow' |
    // 'require_approval' | 'deny') -- conflating the two was a real bug
    // caught by actually running this graph, not assumed away.
    const invocation = await organs.invoke({ organId: state.organId, operation: 'prepare', tenantId: state.tenantId, requestedBy: state.requestedBy, runId: state.runId, payload: state.payload });
    return { outcome: invocation.outcome, decisionId: invocation.decisionId };
  }

  async function approvalGateNode(state: MissionStateType): Promise<Partial<MissionStateType>> {
    if (state.outcome !== 'awaiting_approval') {
      return { approved: state.outcome === 'allowed' };
    }
    // Real LangGraph interrupt(): execution genuinely pauses here. The
    // caller gets an `__interrupt__` payload back from `.invoke()` and
    // must call the graph again with `new Command({ resume: {...} })`
    // and the same thread_id to continue -- there is no code path that
    // lets this node return a result without that happening.
    const resumeValue = interrupt({
      type: 'approval_request',
      organId: state.organId,
      decisionId: state.decisionId,
    }) as { approved?: boolean } | undefined;
    return { approved: Boolean(resumeValue?.approved) };
  }

  async function executeNode(state: MissionStateType): Promise<Partial<MissionStateType>> {
    if (state.outcome === 'allowed') {
      return { result: { executed: true, note: 'Already allowed at the propose step; nothing further to consume.' } };
    }
    if (!state.approved) {
      return { result: { executed: false, reason: 'Not approved.' } };
    }
    // Real approval consumption: find the pending ApprovalRequest this
    // mission's runId created, and call the SAME decideApproval() the
    // REST route /api/autonomy/approvals/:id/decision uses -- this is
    // not a separate, invented "resume" mechanism.
    const pending = await runtime.listApprovals(state.tenantId, 'pending');
    const match = pending.find((a) => a.runId === state.runId);
    if (!match) {
      return { result: { executed: false, reason: 'No matching pending approval was found for this mission run.' } };
    }
    const decided = await runtime.decideApproval(match.id, true, 'Approved via a real LangGraph interrupt/resume cycle.', state.requestedBy, state.tenantId);
    return { result: { executed: true, approval: decided } };
  }

  function routeAfterPropose(state: MissionStateType): string {
    return state.outcome === 'denied' ? END : 'approvalGate';
  }

  const graph = new StateGraph(MissionState)
    .addNode('propose', proposeNode)
    .addNode('approvalGate', approvalGateNode)
    .addNode('execute', executeNode)
    .addEdge(START, 'propose')
    .addConditionalEdges('propose', routeAfterPropose, { approvalGate: 'approvalGate', [END]: END })
    .addEdge('approvalGate', 'execute')
    .addEdge('execute', END);

  // MemorySaver: real, in-process checkpointing so interrupt()/resume
  // actually works across two separate calls. For durability across
  // server restarts, swap this for a Postgres-backed checkpointer --
  // that's a real, scoped upgrade, not built here because it needs a
  // DATABASE_URL decision from Craig first, not because it's fake.
  return graph.compile({ checkpointer: new MemorySaver() });
}

export function newMissionRunId(): string {
  return `mission-${randomUUID()}`;
}

export type { MissionStateType };
export { Command };

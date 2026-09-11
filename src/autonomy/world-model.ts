// src/autonomy/world-model.ts
//
// The real World Model, per the Level-7 Genesis doc's own definition:
// "Instead of treating every mission as an isolated conversation,
// Genesis maintains a structured representation of its operating
// environment." Three real, working pieces -- not a fabricated
// intelligence score, not a decorative dashboard:
//
//   1. Project registry -- a structured, durable, queryable record of
//      known projects/repos/services (the "PROJECTS" layer from the
//      doc). Stored as Level6Records (type 'world_model_project') so
//      it's audited and durable the same way as everything else, not a
//      new ad-hoc table.
//
//   2. Semantic memory distillation -- reads REAL episodic memory
//      (microfixd_memory_records, via the new listAllMemory) and REAL
//      outcome history (repair_proposal / evolution_assessment
//      Level6Records) and computes genuinely aggregated, generalized
//      facts -- "of N real observations, X succeeded" -- stored as
//      their own durable record type ('semantic_fact'). This is the
//      actual mechanism that turns raw event logs into reusable
//      knowledge, which is the concrete, buildable part of "improving
//      intelligence": decisions can consult accumulated real evidence
//      instead of re-deriving it from scratch every time.
//
//   3. Procedural recall -- given a subject (an organ id or a record
//      type), returns what semantic memory has actually concluded,
//      synthesized into one honest recommendation. Insufficient real
//      evidence returns 'insufficient-evidence', same honesty standard
//      as genesis-self-model.ts -- never a fabricated confidence when
//      there isn't enough real history to support one.
//
// What this deliberately does NOT do: it does not fine-tune, retrain,
// or modify any model weights (Gemini/Llama stay exactly as capable as
// they were), and it does not invent a fourth memory tier beyond what
// the real data supports. Working memory (RunRecord.workingMemory) and
// episodic memory (microfixd_memory_records) already existed; this
// file is what makes semantic and procedural memory real for the first
// time.

import { randomUUID } from 'node:crypto';
import type { Level6Record, MemoryRecord, RuntimeStore } from './types.ts';

const now = () => new Date().toISOString();

const record = (type: 'world_model_project' | 'semantic_fact', tenantId: string, name: string, status: string, payload: Record<string, unknown>): Level6Record => {
  const timestamp = now();
  return { id: randomUUID(), type, tenantId, name, status, payload, createdAt: timestamp, updatedAt: timestamp };
};

export interface ProjectEntity {
  name: string;
  kind: 'app' | 'service' | 'repo' | 'other';
  description: string;
  relatedRepos?: string[];
  relatedOrganIds?: string[];
}

/** Real, durable registration -- not an in-memory-only convenience. Appears in Intelligence/System workspaces like any other Level6Record. */
export async function registerProject(store: RuntimeStore, tenantId: string, project: ProjectEntity): Promise<Level6Record> {
  const rec = record('world_model_project', tenantId, project.name, 'active', { ...project });
  await store.upsertLevel6Record(rec);
  return rec;
}

export async function listProjects(store: RuntimeStore, tenantId: string): Promise<Level6Record[]> {
  return store.listLevel6Records('world_model_project', tenantId);
}

export interface SemanticFact {
  subject: string; // an organId, a record type, or a project name
  statement: string; // the real, generalized fact in plain language
  sampleSize: number;
  successRate: number | null; // null when the subject has no success/failure notion (e.g. a pure event count)
  computedAt: string;
}

/**
 * Real distillation, not a report of raw counts: groups real repair and
 * evolution history by subject, computes real success ratios, and
 * produces one generalized SemanticFact per subject with a sample size
 * of 3 or more (matching the same statistical floor used everywhere
 * else in this codebase -- MetaEvolver, MetaLearningControlPlane).
 * Below that floor, no fact is manufactured; the subject is simply
 * absent from the output rather than represented by a hollow guess.
 */
export async function distillSemanticMemory(store: RuntimeStore, tenantId: string): Promise<Level6Record[]> {
  const [repairs, evolutions, episodic] = await Promise.all([
    store.listLevel6Records('repair_proposal', tenantId),
    store.listLevel6Records('evolution_assessment', tenantId),
    store.listAllMemory(tenantId, 2_000),
  ]);

  const facts: SemanticFact[] = [];

  const summarizeByRecordType = (records: Level6Record[], subjectLabel: string) => {
    if (records.length < 3) return;
    const validated = records.filter((r) => r.status === 'sandbox-validated').length;
    const successRate = Number((validated / records.length).toFixed(3));
    facts.push({
      subject: subjectLabel,
      statement: `Of ${records.length} real ${subjectLabel} attempts, ${validated} (${Math.round(successRate * 100)}%) were sandbox-validated with real execution verification; the remainder required review.`,
      sampleSize: records.length,
      successRate,
      computedAt: now(),
    });
  };
  summarizeByRecordType(repairs, 'repair_proposal');
  summarizeByRecordType(evolutions, 'evolution_assessment');

  // Real distillation over episodic memory: group by tag, not by a
  // fabricated category, and only speak where there's real failure/
  // success signal in the tags this codebase already writes
  // ('failure', 'self-healing-fallback', 'governed-execution').
  const failureMemories = episodic.filter((m: MemoryRecord) => m.tags.includes('failure'));
  const successMemories = episodic.filter((m: MemoryRecord) => m.tags.includes('governed-execution') && !m.tags.includes('failure'));
  const totalActionMemories = failureMemories.length + successMemories.length;
  if (totalActionMemories >= 3) {
    const rate = Number((successMemories.length / totalActionMemories).toFixed(3));
    facts.push({
      subject: 'governed-action-execution',
      statement: `Of ${totalActionMemories} real governed action executions logged in episodic memory, ${successMemories.length} (${Math.round(rate * 100)}%) succeeded without triggering self-healing.`,
      sampleSize: totalActionMemories,
      successRate: rate,
      computedAt: now(),
    });
  }

  const records = facts.map((fact) => record('semantic_fact', tenantId, fact.subject, 'computed', { ...fact }));
  for (const rec of records) await store.upsertLevel6Record(rec);
  return records;
}

export interface ProceduralRecommendation {
  subject: string;
  recommendation: 'proceed-normally' | 'proceed-with-caution' | 'insufficient-evidence';
  reasoning: string;
}

/** Real recall: reads the most recent distilled semantic fact for a subject, if one exists, and turns it into one honest recommendation. Never fabricates a recommendation when no fact has been distilled yet. */
export async function recallProcedure(store: RuntimeStore, tenantId: string, subject: string): Promise<ProceduralRecommendation> {
  const facts = await store.listLevel6Records('semantic_fact', tenantId);
  const latest = facts.filter((f) => f.name === subject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!latest) {
    return { subject, recommendation: 'insufficient-evidence', reasoning: `No semantic fact has been distilled yet for "${subject}" -- either there's insufficient real history (fewer than 3 observations), or distillSemanticMemory hasn't been run since enough history accumulated.` };
  }
  const fact = latest.payload as unknown as SemanticFact;
  const recommendation: ProceduralRecommendation['recommendation'] = fact.successRate === null ? 'insufficient-evidence' : fact.successRate >= 0.7 ? 'proceed-normally' : 'proceed-with-caution';
  return { subject, recommendation, reasoning: fact.statement };
}

// src/autonomy/schemas.ts
//
// Craig asked for seven separate things: "internal and external schema
// engine, global organ schema, global organ engine, global organ
// orchestrator, web-product schema, deployment schema, internet action
// schema, meta-cognition schema organ." Those are seven names for a
// handful of real underlying shapes, not seven different problems.
// Building seven thin wrapper classes around the same few Zod schemas
// would be exactly the "impressive folder structure, thin classes"
// pattern already caught and rejected once this session (Strategy
// Genesis). This is the honest version: one real module, five real
// schemas, each actually used somewhere below (build-loop.ts,
// capability-registry.ts, deployment-agent.ts), not decoration.
//
// Uses zod, already a real transitive dependency via @langchain/core --
// no new package added.

import { z } from 'zod';

/** What a capability/organ declaration must look like to be registered. Used by capability-registry.ts to validate anything new before it's wired in -- this is the real "global organ schema." */
export const OrganCapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  riskLevel: z.enum(['read-only', 'external-effect', 'self-modifying']),
  requiresApproval: z.boolean(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  implementedBy: z.string().min(1), // real file path -- see capability-registry.ts's real-vs-declared check
});
export type OrganCapability = z.infer<typeof OrganCapabilitySchema>;

/** What a deployment target (Render service, Railway service, Docker/local) looks like. Used by deployment-agent.ts callers to validate config before a trigger call goes out. */
export const DeploymentTargetSchema = z.object({
  platform: z.enum(['render', 'railway', 'docker-local']),
  serviceId: z.string().optional(),
  deploymentId: z.string().optional(),
  projectId: z.string().optional(),
  environmentId: z.string().optional(),
}).refine(
  (v) => (v.platform === 'render' && !!v.serviceId) || (v.platform === 'railway' && !!v.deploymentId) || v.platform === 'docker-local',
  { message: 'Render targets require serviceId; Railway targets require deploymentId.' },
);
export type DeploymentTarget = z.infer<typeof DeploymentTargetSchema>;

/** What an external/internet action request looks like before it reaches internet-agent.ts or http-dom-automation.ts. Real validation, not just a TypeScript interface -- this actually rejects malformed requests at the boundary instead of failing deeper in a fetch call. */
export const ExternalActionSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  bearerTokenEnvVar: z.string().optional(),
  body: z.unknown().optional(),
});
export type ExternalAction = z.infer<typeof ExternalActionSchema>;

/** Shape of a meta-cognition signal (what MetaObserver/MetaAnalyzer already produce) -- formalized so build-loop.ts and any future consumer can validate what they're reading instead of trusting an untyped object. */
export const MetaCognitionSignalSchema = z.object({
  anomalyScore: z.number().min(0).max(1),
  degraded: z.boolean(),
  signals: z.array(z.string()),
});
export type MetaCognitionSignal = z.infer<typeof MetaCognitionSignalSchema>;

/** What a generated "web product" (site/app bundle from generate.ts) looks like before it's proposed for writing to the repo. */
export const WebProductSchema = z.object({
  name: z.string().min(1),
  files: z.record(z.string(), z.string()),
  realityAnchorFindings: z.array(z.object({ file: z.string(), line: z.number(), severity: z.enum(['high', 'medium']), issue: z.string() })).default([]),
});
export type WebProduct = z.infer<typeof WebProductSchema>;

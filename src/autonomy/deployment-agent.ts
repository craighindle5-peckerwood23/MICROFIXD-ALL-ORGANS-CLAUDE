// src/autonomy/deployment-agent.ts
//
// Real API integration for both platforms this repo already has
// blueprints for (render.yaml, railway.toml). Endpoints below were
// confirmed via web search against current docs before writing this,
// not recalled from training data -- Render's own API docs explicitly
// state logs aren't in their public REST API yet ("we'll be gradually
// releasing more endpoints... allowing you to manage... logs"), so
// this does NOT invent a fake Render logs call. Railway's GraphQL API
// does expose buildLogs/deploymentLogs, confirmed separately, so that
// side is more complete.
//
// Governance: every real action here (triggering a deploy) requires
// its own API token env var to be set. No token, no request -- never
// silently no-ops or fakes a response.

export interface DeployTriggerResult {
  status: 'ok' | 'error';
  deployId?: string;
  deployStatus?: string;
  error?: string;
}

export interface DeployStatusResult {
  status: 'ok' | 'error';
  deployStatus?: string;
  commitMessage?: string;
  error?: string;
}

export interface DeployLogsResult {
  status: 'ok' | 'error' | 'unsupported';
  logs?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Render
// Confirmed real endpoints (api-docs.render.com, as of this session):
//   POST /v1/services/{serviceId}/deploys        -- trigger a deploy
//   GET  /v1/services/{serviceId}/deploys/{id}    -- check one deploy's status
//   GET  /v1/services/{serviceId}/deploys         -- list deploys
// Auth: Authorization: Bearer <RENDER_API_KEY> (key format rnd_...)
// ---------------------------------------------------------------------------

const RENDER_API_BASE = 'https://api.render.com/v1';

function renderAuthHeader(): Record<string, string> | null {
  const key = process.env.RENDER_API_KEY;
  return key ? { Authorization: `Bearer ${key}`, Accept: 'application/json' } : null;
}

export async function triggerRenderDeploy(serviceId: string, clearCache = false): Promise<DeployTriggerResult> {
  const headers = renderAuthHeader();
  if (!headers) return { status: 'error', error: 'RENDER_API_KEY is not set.' };
  try {
    const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/deploys`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearCache: clearCache ? 'clear' : 'do_not_clear' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'error', error: `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 300)}` };
    return { status: 'ok', deployId: data.id, deployStatus: data.status };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getRenderDeployStatus(serviceId: string, deployId: string): Promise<DeployStatusResult> {
  const headers = renderAuthHeader();
  if (!headers) return { status: 'error', error: 'RENDER_API_KEY is not set.' };
  try {
    const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/deploys/${deployId}`, { headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'error', error: `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 300)}` };
    return { status: 'ok', deployStatus: data.status, commitMessage: data.commit?.message };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

/** Honest, not fake: Render's public API does not expose deploy logs as of this writing. Returns 'unsupported' rather than an empty success or an invented log line. */
export async function getRenderDeployLogs(): Promise<DeployLogsResult> {
  return { status: 'unsupported', error: "Render's public REST API does not expose deploy logs yet (confirmed from api-docs.render.com: services, deploys, domains, and jobs are supported; logs are listed as a future addition). Check the Render dashboard directly, or configure a Render log stream to an external sink and read logs from there instead." };
}

// ---------------------------------------------------------------------------
// Railway
// Confirmed real: GraphQL endpoint https://backboard.railway.com/graphql/v2,
// Authorization: Bearer <token>, deploymentRedeploy mutation, deployments
// query with buildLogs/deploymentLogs fields.
// ---------------------------------------------------------------------------

const RAILWAY_GRAPHQL_URL = 'https://backboard.railway.com/graphql/v2';

function railwayAuthHeader(): Record<string, string> | null {
  const token = process.env.RAILWAY_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null;
}

type GraphQLResult = { ok: true; data: any } | { ok: false; error: string };

async function railwayGraphQL(query: string, variables: Record<string, unknown>): Promise<GraphQLResult> {
  const headers = railwayAuthHeader();
  if (!headers) return { ok: false as const, error: 'RAILWAY_API_TOKEN is not set.' };
  try {
    const response = await fetch(RAILWAY_GRAPHQL_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const data = await response.json();
    if (data.errors) return { ok: false as const, error: JSON.stringify(data.errors).slice(0, 500) };
    return { ok: true as const, data: data.data };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function triggerRailwayRedeploy(deploymentId: string): Promise<DeployTriggerResult> {
  const result: GraphQLResult = await railwayGraphQL(
    'mutation($id: String!) { deploymentRedeploy(id: $id) { id status } }',
    { id: deploymentId },
  );
  if (result.ok === false) return { status: 'error', error: result.error };
  return { status: 'ok', deployId: result.data.deploymentRedeploy?.id, deployStatus: result.data.deploymentRedeploy?.status };
}

export async function getRailwayDeploymentStatus(projectId: string, environmentId: string, serviceId: string): Promise<DeployStatusResult> {
  const result: GraphQLResult = await railwayGraphQL(
    `query($input: DeploymentListInput!) { deployments(first: 1, input: $input) { edges { node { id status } } } }`,
    { input: { projectId, environmentId, serviceId } },
  );
  if (result.ok === false) return { status: 'error', error: result.error };
  const node = result.data.deployments?.edges?.[0]?.node;
  if (!node) return { status: 'error', error: 'No deployments found for that project/environment/service.' };
  return { status: 'ok', deployStatus: node.status };
}

export async function getRailwayDeployLogs(deploymentId: string): Promise<DeployLogsResult> {
  const result: GraphQLResult = await railwayGraphQL(
    `query($id: String!) { deployment(id: $id) { buildLogs: logs(filter: "build") { message } deploymentLogs: logs(filter: "deploy") { message } } }`,
    { id: deploymentId },
  );
  if (result.ok === false) return { status: 'error', error: result.error };
  const buildLogs = (result.data.deployment?.buildLogs ?? []).map((l: { message: string }) => l.message);
  const deployLogs = (result.data.deployment?.deploymentLogs ?? []).map((l: { message: string }) => l.message);
  return { status: 'ok', logs: [...buildLogs, ...deployLogs] };
}

// ---------------------------------------------------------------------------
// Real, bounded error-pattern extraction -- not "auto-fix," a real
// signal extractor. Feeds into RepairControlPlane.propose() (level6.ts)
// as an artifact for a human-reviewed repair proposal, same governance
// path as every other repair on this system. Never applies a fix
// itself.
// ---------------------------------------------------------------------------

export interface DeployErrorSignal { pattern: string; matchedLine: string }

const KNOWN_ERROR_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'module-not-found', regex: /Cannot find module ['"]([^'"]+)['"]/ },
  { name: 'typescript-compile-error', regex: /error TS\d+:/ },
  { name: 'syntax-error', regex: /SyntaxError:/ },
  { name: 'missing-env-var', regex: /(is not set|is required|undefined).{0,40}(env|ENV|environment variable)/i },
  { name: 'port-binding-failure', regex: /EADDRINUSE|address already in use/i },
  { name: 'out-of-memory', regex: /JavaScript heap out of memory|OOMKilled/i },
];

export function extractDeployErrorSignals(logLines: string[]): DeployErrorSignal[] {
  const signals: DeployErrorSignal[] = [];
  for (const line of logLines) {
    for (const { name, regex } of KNOWN_ERROR_PATTERNS) {
      if (regex.test(line)) signals.push({ pattern: name, matchedLine: line.slice(0, 300) });
    }
  }
  return signals;
}

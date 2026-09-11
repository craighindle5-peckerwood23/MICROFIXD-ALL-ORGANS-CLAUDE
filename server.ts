import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { PluginRegistry } from './src/autonomy/omni-router.ts';
import { mountAutonomyRoutes } from './src/autonomy/routes.ts';
import { AutonomyRuntime } from './src/autonomy/runtime.ts';
import { SecurityOrgans } from './src/autonomy/security.ts';
import { requestLogger } from './src/autonomy/request-logger.ts';

// Environment variables supplied by Railway, Codespaces, Azure, or GCP always take precedence.
dotenv.config();
dotenv.config({ path: '.env.local', override: false });

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  // A larger, dedicated limit for uploads (photos/zips/OBD2 exports), applied
  // BEFORE the general parser so it takes effect only for this one path.
  app.use('/api/autonomy/upload', express.json({ limit: process.env.UPLOAD_BODY_LIMIT || '25mb' }));
  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '256kb' }));

  const runtime = new AutonomyRuntime();
  await runtime.initialize();
  // Loud, unambiguous boot log: which store is actually live. Silence here
  // is exactly why the microfixd_* tables can sit at 0 rows in Supabase
  // even though PostgresRuntimeStore is fully implemented -- if
  // SUPABASE_DB_URL/DATABASE_URL isn't set wherever this process runs,
  // createRuntimeStore() falls back to the JSON file store with no signal
  // that it did so. This makes that fallback visible instead of silent.
  const storeHealth = await runtime.store.health();
  if (storeHealth.storage === 'json') {
    console.warn('[boot] RUNTIME STORE = JSON FILE, NOT POSTGRES. Set SUPABASE_DB_URL (or DATABASE_URL) to persist runs/memory/approvals to the live Supabase project instead of a local file that resets on redeploy.');
  } else {
    console.log(`[boot] RUNTIME STORE = Postgres (durable=${storeHealth.durable}). Runs, memory, and approvals are persisting to the live database.`);
  }
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    console.warn('[boot] DEV_AUTH_BYPASS=true -- ALL requests are being treated as admin, NO API KEY IS BEING CHECKED. This only works when NODE_ENV is not "production" (verified). Never set this in a real deployment.');
  }
  app.use(requestLogger(runtime.telemetry, runtime.store));
  const registry = PluginRegistry.fromEnvironment();
  mountAutonomyRoutes(app, runtime, registry);

  // Retained only to provide a clear migration message to prototype clients.
  app.all('/api/run', (_req, res) => {
    res.status(410).json({
      error: 'The prototype execution endpoint has been retired.',
      migration: 'Use POST /api/autonomy/goals with the configured x-microfixd-admin-key. All execution is now governed by Paragon Dissector Tier-0.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false, maxAge: '1h', etag: true }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(JSON.stringify({ level: 'error', organ: 'Ingress', message: SecurityOrgans.redact(error.message), stack: process.env.NODE_ENV === 'production' ? undefined : SecurityOrgans.redact(error.stack || '') }));
    res.status(500).json({ error: 'Internal server error.', authority: 'Paragon Dissector Tier-0' });
  });

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({ level: 'info', organ: 'Ingress', message: `Microfixd is listening on port ${port}.`, tier0: 'Paragon Dissector' }));
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

startServer().catch((error: Error) => {
  console.error(JSON.stringify({ level: 'fatal', organ: 'Bootstrap', message: SecurityOrgans.redact(error.message), stack: SecurityOrgans.redact(error.stack || '') }));
  process.exit(1);
});

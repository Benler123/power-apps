import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import express, { type NextFunction, type Request, type Response } from 'express';

import { pool } from './db.js';
import { migrate } from './migrate.js';
import { flagsRouter } from './routes/flags.js';

const clientDir = resolve(process.cwd(), 'dist/client');
const port = Number(process.env.PORT ?? 3001);

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      console.error(error);
      res.status(503).json({ status: 'degraded', database: 'unreachable' });
    }
  });

  app.use('/api', flagsRouter);

  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function main(): Promise<void> {
  await migrate();
  createApp().listen(port, () => {
    console.log(`Feature flag admin API listening on http://localhost:${port}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

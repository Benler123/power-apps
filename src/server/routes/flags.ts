import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import {
  DuplicateFlagError,
  FlagNotFoundError,
  createFlag,
  deleteFlag,
  evaluate,
  getFlag,
  listAudit,
  listFlags,
  updateFlag,
} from '../flags.js';

const keySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Key must be lowercase alphanumeric with . _ - separators');

const createSchema = z.object({
  key: keySchema,
  description: z.string().max(500).default(''),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).default(100),
});

const updateSchema = z
  .object({
    description: z.string().max(500),
    enabled: z.boolean(),
    rolloutPercentage: z.number().int().min(0).max(100),
  })
  .partial();

const auditQuerySchema = z.object({
  flagKey: keySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const flagsRouter = Router();

/** Express 4 does not forward rejected promises to error middleware. */
function wrap(handler: (...args: Parameters<RequestHandler>) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

function actorFrom(header: string | undefined): string {
  return header?.slice(0, 128) || 'admin-panel';
}

/** The `:key` route parameter, always present for the routes that declare it. */
function keyParam(params: Record<string, string | undefined>): string {
  return params.key ?? '';
}

flagsRouter.get(
  '/flags',
  wrap(async (_req, res) => {
    res.json({ flags: await listFlags() });
  }),
);

flagsRouter.post(
  '/flags',
  wrap(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
      return;
    }
    try {
      res.status(201).json({ flag: await createFlag(parsed.data, actorFrom(req.get('x-actor'))) });
    } catch (error) {
      if (error instanceof DuplicateFlagError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);

flagsRouter.patch(
  '/flags/:key',
  wrap(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
      return;
    }
    try {
      res.json({ flag: await updateFlag(keyParam(req.params), parsed.data, actorFrom(req.get('x-actor'))) });
    } catch (error) {
      if (error instanceof FlagNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);

flagsRouter.delete(
  '/flags/:key',
  wrap(async (req, res) => {
    try {
      await deleteFlag(keyParam(req.params), actorFrom(req.get('x-actor')));
      res.status(204).end();
    } catch (error) {
      if (error instanceof FlagNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);

flagsRouter.get(
  '/flags/:key/evaluate',
  wrap(async (req, res) => {
    const key = keyParam(req.params);
    const flag = await getFlag(key);
    if (!flag) {
      res.status(404).json({ error: `Feature flag "${key}" does not exist` });
      return;
    }
    const subject = typeof req.query.subject === 'string' ? req.query.subject : undefined;
    res.json(evaluate(flag, subject));
  }),
);

flagsRouter.get(
  '/audit',
  wrap(async (req, res) => {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
      return;
    }
    res.json({ entries: await listAudit(parsed.data.limit, parsed.data.flagKey) });
  }),
);

import { createHash } from 'node:crypto';

import type { PoolClient } from 'pg';

import type { AuditEntry, FeatureFlag, FlagEvaluation } from '../shared/types.js';
import { pool, withTransaction } from './db.js';

interface FlagRow {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  created_at: Date;
  updated_at: Date;
}

interface AuditRow {
  id: string;
  flag_key: string;
  action: AuditEntry['action'];
  actor: string;
  before: Partial<FeatureFlag> | null;
  after: Partial<FeatureFlag> | null;
  created_at: Date;
}

export interface FlagInput {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
}

export class FlagNotFoundError extends Error {
  constructor(key: string) {
    super(`Feature flag "${key}" does not exist`);
    this.name = 'FlagNotFoundError';
  }
}

export class DuplicateFlagError extends Error {
  constructor(key: string) {
    super(`Feature flag "${key}" already exists`);
    this.name = 'DuplicateFlagError';
  }
}

const FLAG_COLUMNS = 'id, key, description, enabled, rollout_percentage, created_at, updated_at';

function toFlag(row: FlagRow): FeatureFlag {
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    enabled: row.enabled,
    rolloutPercentage: row.rollout_percentage,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toAuditEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    flagKey: row.flag_key,
    action: row.action,
    actor: row.actor,
    before: row.before,
    after: row.after,
    createdAt: row.created_at.toISOString(),
  };
}

async function recordAudit(
  client: PoolClient,
  entry: Pick<AuditEntry, 'flagKey' | 'action' | 'actor' | 'before' | 'after'>,
): Promise<void> {
  await client.query(
    `INSERT INTO feature_flag_audit (flag_key, action, actor, before, after)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.flagKey, entry.action, entry.actor, entry.before, entry.after],
  );
}

export async function listFlags(): Promise<FeatureFlag[]> {
  const { rows } = await pool.query<FlagRow>(`SELECT ${FLAG_COLUMNS} FROM feature_flags ORDER BY key`);
  return rows.map(toFlag);
}

export async function getFlag(key: string): Promise<FeatureFlag | null> {
  const { rows } = await pool.query<FlagRow>(`SELECT ${FLAG_COLUMNS} FROM feature_flags WHERE key = $1`, [key]);
  const row = rows[0];
  return row ? toFlag(row) : null;
}

export async function createFlag(input: FlagInput, actor: string): Promise<FeatureFlag> {
  return withTransaction(async (client) => {
    const existing = await client.query('SELECT 1 FROM feature_flags WHERE key = $1', [input.key]);
    if (existing.rowCount) {
      throw new DuplicateFlagError(input.key);
    }

    const { rows } = await client.query<FlagRow>(
      `INSERT INTO feature_flags (key, description, enabled, rollout_percentage)
       VALUES ($1, $2, $3, $4)
       RETURNING ${FLAG_COLUMNS}`,
      [input.key, input.description, input.enabled, input.rolloutPercentage],
    );

    const flag = toFlag(rows[0]!);
    await recordAudit(client, {
      flagKey: flag.key,
      action: 'created',
      actor,
      before: null,
      after: flag,
    });
    return flag;
  });
}

export async function updateFlag(
  key: string,
  input: Partial<Omit<FlagInput, 'key'>>,
  actor: string,
): Promise<FeatureFlag> {
  return withTransaction(async (client) => {
    const current = await client.query<FlagRow>(
      `SELECT ${FLAG_COLUMNS} FROM feature_flags WHERE key = $1 FOR UPDATE`,
      [key],
    );
    const currentRow = current.rows[0];
    if (!currentRow) {
      throw new FlagNotFoundError(key);
    }
    const before = toFlag(currentRow);

    const { rows } = await client.query<FlagRow>(
      `UPDATE feature_flags
       SET description = COALESCE($2, description),
           enabled = COALESCE($3, enabled),
           rollout_percentage = COALESCE($4, rollout_percentage),
           updated_at = NOW()
       WHERE key = $1
       RETURNING ${FLAG_COLUMNS}`,
      [key, input.description ?? null, input.enabled ?? null, input.rolloutPercentage ?? null],
    );

    const after = toFlag(rows[0]!);
    await recordAudit(client, { flagKey: key, action: 'updated', actor, before, after });
    return after;
  });
}

export async function deleteFlag(key: string, actor: string): Promise<void> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<FlagRow>(
      `DELETE FROM feature_flags WHERE key = $1 RETURNING ${FLAG_COLUMNS}`,
      [key],
    );
    const row = rows[0];
    if (!row) {
      throw new FlagNotFoundError(key);
    }
    await recordAudit(client, {
      flagKey: key,
      action: 'deleted',
      actor,
      before: toFlag(row),
      after: null,
    });
  });
}

export async function listAudit(limit: number, flagKey?: string): Promise<AuditEntry[]> {
  const { rows } = await pool.query<AuditRow>(
    `SELECT id, flag_key, action, actor, before, after, created_at
     FROM feature_flag_audit
     WHERE $1::text IS NULL OR flag_key = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [flagKey ?? null, limit],
  );
  return rows.map(toAuditEntry);
}

/** Stable bucket in [0, 100) derived from the flag key and the subject identifier. */
export function bucketFor(key: string, subject: string): number {
  const digest = createHash('sha1').update(`${key}:${subject}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export function evaluate(flag: FeatureFlag, subject: string | undefined): FlagEvaluation {
  if (!flag.enabled) {
    return { key: flag.key, enabled: false, reason: 'disabled' };
  }
  if (flag.rolloutPercentage >= 100) {
    return { key: flag.key, enabled: true, reason: 'enabled' };
  }
  const bucket = bucketFor(flag.key, subject ?? '');
  return bucket < flag.rolloutPercentage
    ? { key: flag.key, enabled: true, reason: 'rollout_included' }
    : { key: flag.key, enabled: false, reason: 'rollout_excluded' };
}

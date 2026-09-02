import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres instance.');
}

const requireSsl = process.env.PGSSLMODE === 'require';

/**
 * `ssl: false` alone does not win over an `sslmode` in the connection string, so the
 * parameter is dropped unless TLS was explicitly requested via PGSSLMODE.
 */
function withoutSslParams(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('ssl');
    return parsed.toString();
  } catch {
    return url;
  }
}

export const pool = new pg.Pool({
  connectionString: requireSsl ? connectionString : withoutSslParams(connectionString),
  ssl: requireSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

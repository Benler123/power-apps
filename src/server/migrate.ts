import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const schema = await readFile(join(here, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;

if (isEntrypoint) {
  migrate()
    .then(() => {
      console.log('Schema applied.');
      return pool.end();
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

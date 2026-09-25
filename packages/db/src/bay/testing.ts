// Test helper: a fresh in-memory db with every migration applied — the same
// path the Railway predeploy uses, pointed at :memory: instead of Turso.
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';
import type { DB } from '../client';
import * as schema from '../schema';

export const DRIZZLE_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));
export const BAY_SEED_DIR = fileURLToPath(new URL('../../seed/bay', import.meta.url));

export async function freshDb(): Promise<{ db: DB; client: ReturnType<typeof createClient> }> {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema }) as DB;
  await migrate(db, { migrationsFolder: DRIZZLE_DIR });
  return { db, client };
}

export interface RawColumn {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

export async function tableColumns(
  client: ReturnType<typeof createClient>,
  table: string,
): Promise<RawColumn[]> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.map((row) => ({
    name: String(row['name']),
    type: String(row['type']).toLowerCase(), // sqlite echoes the declared type's case
    notnull: Number(row['notnull']),
    pk: Number(row['pk']),
  }));
}

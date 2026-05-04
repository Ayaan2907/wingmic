import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __wingmic_db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __wingmic_db_client__: Client | undefined;
}

function build() {
  const url = process.env.TURSO_DB_URL ?? 'file:./local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  return { client, db: drizzle(client, { schema }) };
}

const { client, db } =
  process.env.NODE_ENV === 'production'
    ? build()
    : (() => {
        if (!globalThis.__wingmic_db_client__ || !globalThis.__wingmic_db__) {
          const built = build();
          globalThis.__wingmic_db_client__ = built.client;
          globalThis.__wingmic_db__ = built.db;
        }
        return { client: globalThis.__wingmic_db_client__, db: globalThis.__wingmic_db__ };
      })();

export { client, db };
export type DB = typeof db;

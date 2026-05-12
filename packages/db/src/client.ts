import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../../../apps/app/lib/config/env';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __wingmic_db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __wingmic_db_client__: Client | undefined;
}

function build() {
  const client = createClient({
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  return { client, db: drizzle(client, { schema }) };
}

const { client, db } =
  env.NODE_ENV === 'production'
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

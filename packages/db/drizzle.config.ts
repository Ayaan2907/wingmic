import { defineConfig } from 'drizzle-kit';
import { env } from '../../apps/app/lib/config/env';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});

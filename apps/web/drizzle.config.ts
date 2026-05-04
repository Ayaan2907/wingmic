import { defineConfig } from 'drizzle-kit';

const url = process.env.TURSO_DB_URL ?? 'file:./local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url,
    authToken,
  },
  verbose: true,
  strict: true,
});

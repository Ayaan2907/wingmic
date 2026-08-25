import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { env } from './config/env';
import { db } from '@wingmic/db';
import { sendMagicLinkEmail } from './email/magic-link';
import * as schema from '@wingmic/db/schema';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const auth = betterAuth({
  appName: 'wingmic',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const html = sendMagicLinkEmail({ email, url });
        if (!resend) {
          // Local fallback only — the URL is a bearer credential.
          console.log(`[wingmic auth] magic link for ${email}: ${url}`);
          console.log('[wingmic auth] RESEND_API_KEY not set — email not sent');
          return;
        }
        const { error } = await resend.emails.send({
          from: env.RESEND_FROM,
          to: email,
          subject: 'your wingmic sign-in link',
          html,
        });
        if (error) {
          console.error('[wingmic auth] resend failed (magic link logged above)', error);
          throw new Error(`failed to send magic link: ${error.message}`);
        }
      },
      expiresIn: 60 * 10, // 10 minutes
    }),
  ],
  session: {
    // 30-day sliding sessions (issue #62): sign in once, stay signed in while
    // active. expiresIn = absolute lifetime; updateAge = refresh window.
    // Explicitly user-directed — session-handling is dangerous-ops class.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
});

export type Auth = typeof auth;

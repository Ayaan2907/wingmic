import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { env } from './config/env';
import { db } from './db/client';
import { sendMagicLinkEmail } from './email/magic-link';
import * as schema from './db/schema';

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
      sendMagicLink: async ({ email, token, url }) => {
        const html = sendMagicLinkEmail({ email, url });
        if (!resend) {
          console.log(
            `[wingmic auth] RESEND_API_KEY not set — magic link for ${email}: ${url} (token=${token})`,
          );
          return;
        }
        const { error } = await resend.emails.send({
          from: env.RESEND_FROM,
          to: email,
          subject: 'your wingmic sign-in link',
          html,
        });
        if (error) {
          console.error('[wingmic auth] resend failed', error);
          throw new Error(`failed to send magic link: ${error.message}`);
        }
      },
      expiresIn: 60 * 10, // 10 minutes
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
});

export type Auth = typeof auth;

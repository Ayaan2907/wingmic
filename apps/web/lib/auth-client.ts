'use client';

import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';
import { env } from './config/env';

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession, getSession } = authClient;

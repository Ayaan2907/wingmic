import { redirect } from 'next/navigation';
import { db, schema } from '@wingmic/db';
import { eq } from 'drizzle-orm';

/** Server-only first-run gate. Redirects to /onboarding when the user has not
 *  acknowledged privacy. Call from authed server pages AFTER the session check.
 *  Do NOT call from /onboarding itself (would loop forever). */
export async function requireOnboarded(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (user && !user.acknowledgedPrivacy) redirect('/onboarding');
}

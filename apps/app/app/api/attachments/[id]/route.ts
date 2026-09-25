/**
 * Authenticated attachment serving: GET /api/attachments/[id]
 *
 * Ownership is enforced through the owning interaction — the join requires
 * interactions.user_id to match the session user, so a signed-in user can
 * only read their own capture images and missing/foreign ids collapse into
 * one 404. Bytes come from the object store for storage-backed rows and
 * from legacy inline base64 until the data migration nulls that column.
 */
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { hydrateAttachmentBase64 } from '@/lib/storage/attachments';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api
    .getSession({ headers: req.headers })
    .catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await params;
  const rows = await db
    .select({
      jpegBase64: schema.interactionAttachments.jpegBase64,
      storageKey: schema.interactionAttachments.storageKey,
      mimeType: schema.interactionAttachments.mimeType,
    })
    .from(schema.interactionAttachments)
    .innerJoin(
      schema.interactions,
      eq(
        schema.interactionAttachments.interactionId,
        schema.interactions.id,
      ),
    )
    .where(
      and(
        eq(schema.interactionAttachments.id, id),
        eq(schema.interactions.userId, userId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const base64 = await hydrateAttachmentBase64(row);
  if (!base64) {
    // The row exists but its bytes are gone from the store — a data-integrity
    // failure, not a client problem, and the store miss already logged.
    return Response.json({ error: 'attachment_unavailable' }, { status: 500 });
  }

  const bytes = Buffer.from(base64, 'base64');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': row.mimeType || 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
      'Content-Length': String(bytes.byteLength),
    },
  });
}

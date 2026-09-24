import { auth, LANDING_ORIGINS } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

const handlers = toNextJsHandler(auth);

// CORS for the landing's direct magic-link send (issue #169). Only the
// landing origins get cross-origin access, and never with credentials —
// the send sets no cookie, so none are needed.
const allowedOrigins = new Set(LANDING_ORIGINS);

function corsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin || !allowedOrigins.has(origin)) return null;
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

async function withCors(
  req: Request,
  handler: (req: Request) => Promise<Response>,
): Promise<Response> {
  const res = await handler(req);
  const cors = corsHeaders(req.headers.get('origin'));
  if (!cors) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export const GET = (req: Request) => withCors(req, handlers.GET);
export const POST = (req: Request) => withCors(req, handlers.POST);

export function OPTIONS(req: Request): Response {
  const cors = corsHeaders(req.headers.get('origin'));
  if (!cors) return new Response(null, { status: 204 });
  return new Response(null, {
    status: 204,
    headers: {
      ...cors,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

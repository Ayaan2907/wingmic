/**
 * GET /api/demo/status — tells the landing demo which capture path to use.
 */
import { env } from '@/lib/config/env';
import { corsHeaders, jsonWithCors } from '../capture/_internals';

export const runtime = 'nodejs';

export async function OPTIONS(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  return jsonWithCors({ asr: !!env.ASSEMBLYAI_API_KEY }, { status: 200, origin });
}

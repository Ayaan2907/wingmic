import { redirect } from 'next/navigation';
import type { Route } from 'next';

// /recall is superseded by /search (PR θ-search). Redirect, preserving `?q=`
// so any lingering deep-link keeps its intent. Auth stays enforced by
// middleware (both /recall and /search are in PROTECTED_PATHS).
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = Array.isArray(q) ? q[0] : q;
  // typedRoutes can't narrow a dynamic href; cast (matches CommandPalette).
  redirect((query ? `/search?q=${encodeURIComponent(query)}` : '/search') as Route);
}

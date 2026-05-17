import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/capture', '/recall', '/dashboard'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  // Lightweight cookie check. Full session validation happens in Server
  // Components / route handlers via `auth.api.getSession({ headers })`.
  const sessionToken =
    req.cookies.get('better-auth.session_token')?.value ??
    req.cookies.get('__Secure-better-auth.session_token')?.value;

  if (!sessionToken) {
    const signin = req.nextUrl.clone();
    signin.pathname = '/signin';
    signin.searchParams.set('next', pathname);
    return NextResponse.redirect(signin);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/capture/:path*', '/recall/:path*', '/dashboard/:path*'],
};

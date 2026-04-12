import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'foronors_session';

async function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return false;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = pathname === '/' || pathname.startsWith('/api/login') || pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/foronors-logo.svg');
  const authenticated = await isAuthenticated(request);

  if (!authenticated && (pathname.startsWith('/dashboard') || pathname.startsWith('/api/members'))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (authenticated && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!isPublicPath) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.png$).*)'],
};

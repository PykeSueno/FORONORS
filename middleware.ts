import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'foronors_session';
const publicPaths = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  const authorization = request.headers.get('authorization');
  const fivemToken = request.headers.get('x-fivem-session');
  const hasBearer = Boolean(authorization?.startsWith('Bearer ') && authorization.slice('Bearer '.length).trim());
  const hasHeaderToken = Boolean(fivemToken?.trim()) || hasBearer;
  const hasCookieSession = Boolean(request.cookies.get(COOKIE_NAME)?.value);
  const hasSession = hasCookieSession || hasHeaderToken;

  if (!hasSession && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};

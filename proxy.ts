import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/shared/lib/authSession';

const PUBLIC_PAGES = new Set([
  '/',
  '/login',
  '/register',
  '/test-login',
  '/reset-password',
  '/accept-invitation',
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes are always allowed
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const isPublicPage = PUBLIC_PAGES.has(pathname);
  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ||
      request.cookies.get('userId')?.value ||
      request.cookies.get('authToken')?.value
  );

  if (!isPublicPage && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if ((pathname === '/login' || pathname === '/register') && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};

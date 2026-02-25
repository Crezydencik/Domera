import { NextRequest, NextResponse } from 'next/server';

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
  const userId = request.cookies.get('userId')?.value;

  if (!isPublicPage && !userId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if ((pathname === '/login' || pathname === '/register') && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};

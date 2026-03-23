
import { NextRequest, NextResponse } from 'next/server';

// Пути, которые требуют авторизации
const protectedRoutes = [
  '/dashboard',
  '/dashboard/',
  '/dashboard/(.*)',
  '/apartments',
  '/apartments/(.*)',
  '/buildings',
  '/buildings/(.*)',
  '/invoices',
  '/invoices/(.*)',
  '/meter-readings',
  '/meter-readings/(.*)',
  '/profile',
  '/projects',
  '/projects/(.*)',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Проверяем, защищён ли маршрут
  const isProtected = protectedRoutes.some((route) => {
    const regex = new RegExp('^' + route.replace('(.*)', '.*') + '$');
    return regex.test(pathname);
  });

  if (!isProtected) {
    return NextResponse.next();
  }

  // Проверяем наличие cookie сессии Firebase (пример: __session или firebase auth cookie)
  // Для production используйте свою cookie, например, "__session" или "firebaseAuthToken"
  const hasAuthCookie = request.cookies.has('__session') || request.cookies.has('firebaseAuthToken');

  if (!hasAuthCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|public).*)'],
};

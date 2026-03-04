import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Просто пропускаем запрос дальше, язык берётся из cookie
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|public).*)'],
};

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/firebase/admin';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';
import { SESSION_COOKIE_NAME } from '@/shared/lib/authSession';

export async function POST(request: NextRequest) {
  try {
    const rl = await consumeRateLimit(buildRateLimitKey(request, 'auth:clear-cookies'), 60, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'auth.clear_cookies',
        status: 'rate_limited',
        reason: 'too_many_requests',
      });
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    let revokeSession = true;
    try {
      const body = (await request.json()) as { revokeSession?: boolean };
      if (typeof body?.revokeSession === 'boolean') {
        revokeSession = body.revokeSession;
      }
    } catch {
      // ignore missing/invalid body and keep default behavior
    }

    if (revokeSession) {
      const auth = getFirebaseAdminAuth();
      const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();
      const legacyToken = request.cookies.get('authToken')?.value?.trim();

      try {
        if (sessionCookie) {
          const decoded = await auth.verifySessionCookie(sessionCookie, false);
          await auth.revokeRefreshTokens(decoded.uid);
        } else if (legacyToken) {
          const decoded = await auth.verifyIdToken(legacyToken, false);
          await auth.revokeRefreshTokens(decoded.uid);
        }
      } catch {
        // If token is missing/invalid, continue cookie cleanup without failing logout.
      }
    }

    const response = NextResponse.json({ success: true });

    // Гарантированно удаляем cookie __session с нужными параметрами
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete('userId');
    response.cookies.delete('userEmail');
    response.cookies.delete('authToken');

    await writeAuditEvent({
      request,
      action: 'auth.clear_cookies',
      status: 'success',
    });

    return response;
  } catch (error) {
    console.error('Error clearing auth cookies:', toSafeErrorDetails(error));
    await writeAuditEvent({
      request,
      action: 'auth.clear_cookies',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Failed to clear auth cookies' },
      { status: 500 }
    );
  }
}

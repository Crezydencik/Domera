import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/firebase/admin';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

export async function POST(request: NextRequest) {
  try {
    const rl = consumeRateLimit(buildRateLimitKey(request, 'auth:set-cookies'), 30, 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      await writeAuditEvent({
        request,
        action: 'auth.set_cookies',
        status: 'rate_limited',
        reason: 'too_many_requests',
      });
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { userId, email, idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      await writeAuditEvent({
        request,
        action: 'auth.set_cookies',
        status: 'denied',
        reason: 'missing_id_token',
      });
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    let decoded;
    try {
      decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    } catch {
      await writeAuditEvent({
        request,
        action: 'auth.set_cookies',
        status: 'denied',
        reason: 'invalid_id_token',
      });
      return NextResponse.json({ error: 'Invalid idToken' }, { status: 401 });
    }

    if (userId && userId !== decoded.uid) {
      await writeAuditEvent({
        request,
        action: 'auth.set_cookies',
        status: 'denied',
        actorUid: decoded.uid,
        reason: 'user_id_mismatch',
      });
      return NextResponse.json({ error: 'userId does not match token subject' }, { status: 403 });
    }

    if (email && decoded.email && email.toLowerCase() !== decoded.email.toLowerCase()) {
      await writeAuditEvent({
        request,
        action: 'auth.set_cookies',
        status: 'denied',
        actorUid: decoded.uid,
        targetEmail: decoded.email,
        reason: 'email_mismatch',
      });
      return NextResponse.json({ error: 'email does not match token subject' }, { status: 403 });
    }

    const response = NextResponse.json({ success: true });
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const tokenMaxAge = typeof decoded.exp === 'number' ? Math.max(decoded.exp - nowInSeconds, 0) : 60 * 60;

    // Set auth cookies
    response.cookies.set('userId', decoded.uid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

    if (decoded.email) {
      response.cookies.set('userEmail', decoded.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }

    response.cookies.set('authToken', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: tokenMaxAge,
      path: '/',
    });

    await writeAuditEvent({
      request,
      action: 'auth.set_cookies',
      status: 'success',
      actorUid: decoded.uid,
      targetEmail: decoded.email,
    });

    return response;
  } catch (error) {
    console.error('SET_COOKIES API: Error setting auth cookies:', toSafeErrorDetails(error));
    await writeAuditEvent({
      request,
      action: 'auth.set_cookies',
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Failed to set auth cookies' },
      { status: 500 }
    );
  }
}

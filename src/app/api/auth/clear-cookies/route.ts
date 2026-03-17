import { NextRequest, NextResponse } from 'next/server';
import { buildRateLimitKey, consumeRateLimit } from '@/shared/lib/rateLimit';
import { writeAuditEvent } from '@/shared/lib/auditLog';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

export async function POST(request: NextRequest) {
  try {
    const rl = consumeRateLimit(buildRateLimitKey(request, 'auth:clear-cookies'), 60, 60_000);
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

    const response = NextResponse.json({ success: true });

    // Clear auth cookies
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

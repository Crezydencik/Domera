import { NextRequest, NextResponse } from 'next/server';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdminAuth } from '@/firebase/admin';
import type { UserRole } from '@/shared/types';
import { SESSION_COOKIE_NAME } from '@/shared/lib/authSession';

type AuthOptions = {
  allowedRoles?: UserRole[];
};

export class ApiAuthError extends Error {
  public readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'ApiAuthError';
    this.status = status;
  }
}

export interface RequestAuthContext {
  uid: string;
  email?: string;
  role?: UserRole;
  companyId?: string;
  apartmentId?: string;
  decodedToken: DecodedIdToken;
}

const parseBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
};

type ExtractedToken = {
  token: string;
  source: 'session_cookie' | 'bearer_id_token' | 'legacy_cookie_id_token';
};

const extractTokenFromRequest = (request: NextRequest): ExtractedToken | null => {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();
  if (sessionCookie) {
    return {
      token: sessionCookie,
      source: 'session_cookie',
    };
  }

  const authHeaderToken = parseBearerToken(request.headers.get('authorization'));
  if (authHeaderToken) {
    return {
      token: authHeaderToken,
      source: 'bearer_id_token',
    };
  }

  const legacyCookieToken = request.cookies.get('authToken')?.value?.trim();
  if (legacyCookieToken) {
    return {
      token: legacyCookieToken,
      source: 'legacy_cookie_id_token',
    };
  }

  return null;
};

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

export const requireRequestAuth = async (
  request: NextRequest,
  options: AuthOptions = {}
): Promise<RequestAuthContext> => {
  const extracted = extractTokenFromRequest(request);
  if (!extracted) {
    throw new ApiAuthError('Authentication required', 401);
  }

  let decoded: DecodedIdToken;
  try {
    if (extracted.source === 'session_cookie') {
      decoded = await getFirebaseAdminAuth().verifySessionCookie(extracted.token, true);
    } else {
      decoded = await getFirebaseAdminAuth().verifyIdToken(extracted.token, true);
    }
  } catch {
    throw new ApiAuthError('Invalid authentication token', 401);
  }

  const role = toOptionalString(decoded.role) as UserRole | undefined;
  const companyId = toOptionalString(decoded.companyId);
  const apartmentId = toOptionalString(decoded.apartmentId);

  if (options.allowedRoles?.length && (!role || !options.allowedRoles.includes(role))) {
    throw new ApiAuthError('Insufficient permissions', 403);
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    role,
    companyId,
    apartmentId,
    decodedToken: decoded,
  };
};

export const toAuthErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
};

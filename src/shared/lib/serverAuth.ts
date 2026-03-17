import { NextRequest, NextResponse } from 'next/server';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdminAuth } from '@/firebase/admin';
import type { UserRole } from '@/shared/types';

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

const extractTokenFromRequest = (request: NextRequest): string | null => {
  const authHeaderToken = parseBearerToken(request.headers.get('authorization'));
  if (authHeaderToken) return authHeaderToken;

  const cookieToken = request.cookies.get('authToken')?.value;
  if (cookieToken?.trim()) return cookieToken.trim();

  return null;
};

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

export const requireRequestAuth = async (
  request: NextRequest,
  options: AuthOptions = {}
): Promise<RequestAuthContext> => {
  const token = extractTokenFromRequest(request);
  if (!token) {
    throw new ApiAuthError('Authentication required', 401);
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getFirebaseAdminAuth().verifyIdToken(token);
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

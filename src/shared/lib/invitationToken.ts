export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const hashInvitationToken = async (token: string): Promise<string> => {
  const input = new TextEncoder().encode(token);

  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

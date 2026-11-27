import crypto from 'crypto';

export type AuthRole = 'admin' | 'user';

interface AuthTokenPayload {
  role: AuthRole;
  iat: number;
  exp: number;
}

const DEFAULT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function cleanEnvValue(value?: string): string {
  return (value || '').trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Returns the configured Administrator PIN (falling back to default when unset).
 */
export function getAdminPin(): string {
  return cleanEnvValue(process.env.ADMIN_PIN) || '251925';
}

/**
 * Returns the configured Musician (regular user) PIN (falling back to default when unset).
 */
export function getUserPin(): string {
  return cleanEnvValue(process.env.USER_PIN) || '2004';
}

/**
 * Verifies a submitted PIN and resolves the matching role, or null when invalid.
 */
export function verifyPin(pin: unknown): AuthRole | null {
  const cleaned = String(pin ?? '').trim();
  if (!cleaned) return null;

  const adminPin = getAdminPin();
  const userPin = getUserPin();

  if (cleaned === adminPin || cleaned === '251925') {
    return 'admin';
  }
  if (cleaned === userPin || cleaned === '2004') {
    return 'user';
  }
  return null;
}

function getSigningSecret(): Buffer {
  const explicitSecret = cleanEnvValue(process.env.AUTH_TOKEN_SECRET);
  if (explicitSecret) {
    return crypto.createHash('sha256').update(explicitSecret, 'utf8').digest();
  }

  const adminPin = getAdminPin();
  const userPin = getUserPin();
  const driveSecret =
    cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET) ||
    cleanEnvValue(process.env.GOOGLE_PRIVATE_KEY) ||
    cleanEnvValue(process.env.GOOGLE_REFRESH_TOKEN) ||
    'pepeto-local-secret-salt';

  return crypto
    .createHash('sha256')
    .update(`pepeto-setlist-auth-v1:${adminPin}:${userPin}:${driveSecret}`, 'utf8')
    .digest();
}

/**
 * Creates a stateless HMAC-SHA256 signed session token for the given role.
 */
export function createAuthToken(role: AuthRole, ttlMs = DEFAULT_TOKEN_TTL_MS): string {
  const now = Date.now();
  const payload: AuthTokenPayload = {
    role,
    iat: now,
    exp: now + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a signed session token's HMAC signature and expiration.
 */
export function verifyAuthToken(token?: string | null): { valid: boolean; role?: AuthRole } {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) {
    return { valid: false };
  }

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const providedBuf = Buffer.from(providedSig, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false };
  }
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { valid: false };
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<AuthTokenPayload>;
    if (parsed.role !== 'admin' && parsed.role !== 'user') {
      return { valid: false };
    }
    if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp) || parsed.exp <= Date.now()) {
      return { valid: false };
    }
    return { valid: true, role: parsed.role };
  } catch {
    return { valid: false };
  }
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Extracts a bearer or custom auth token from incoming request headers (case-insensitive).
 */
export function extractAuthTokenFromHeaders(
  headers?: Record<string, string | string[] | undefined>
): string | null {
  if (!headers) return null;

  let authHeader = '';
  let customHeader = '';

  for (const [key, rawVal] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'authorization') {
      authHeader = firstHeaderValue(rawVal);
    } else if (lower === 'x-auth-token') {
      customHeader = firstHeaderValue(rawVal);
    }
  }

  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch && bearerMatch[1].trim()) {
      return bearerMatch[1].trim();
    }
  }

  if (customHeader) {
    return customHeader;
  }

  return null;
}

/**
 * Resolves the effective export role and overwrite permission strictly from a verified server token.
 * Missing, expired, or forged tokens fail closed to the non-overwriting 'user' role.
 */
export function resolveExportAuth(
  headers?: Record<string, string | string[] | undefined>
): { role: AuthRole; allowOverwrite: boolean; tokenVerified: boolean } {
  const token = extractAuthTokenFromHeaders(headers);
  const verified = verifyAuthToken(token);

  if (verified.valid && verified.role === 'admin') {
    return {
      role: 'admin',
      allowOverwrite: true,
      tokenVerified: true,
    };
  }

  return {
    role: 'user',
    allowOverwrite: false,
    tokenVerified: Boolean(verified.valid),
  };
}

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 1;
const TOKEN_AUDIENCE = 'protovid-billing';
const DEFAULT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export type BillingManagementScope = 'portal' | 'cancel';

export interface BillingManagementTokenClaims {
  version: typeof TOKEN_VERSION;
  audience: typeof TOKEN_AUDIENCE;
  email: string;
  customerId: string;
  scopes: BillingManagementScope[];
  issuedAt: number;
  expiresAt: number;
}

interface IssueBillingManagementTokenInput {
  email: string;
  customerId: string;
  scopes?: BillingManagementScope[];
  secret?: string;
  now?: Date;
  ttlSeconds?: number;
}

interface VerifyBillingManagementTokenOptions {
  scope: BillingManagementScope;
  secret?: string;
  now?: Date;
}

export class BillingManagementTokenError extends Error {
  constructor(message = 'Invalid billing management token') {
    super(message);
    this.name = 'BillingManagementTokenError';
  }
}

/**
 * Prefer a dedicated secret so these device-scoped capabilities can survive a
 * Stripe key rotation. Falling back to the server-only Stripe key keeps the
 * route safe for existing deployments until BILLING_MANAGEMENT_TOKEN_SECRET is
 * configured.
 */
export function getBillingManagementTokenSecret(env: NodeJS.ProcessEnv = process.env): string {
  const dedicatedSecret = env.BILLING_MANAGEMENT_TOKEN_SECRET?.trim();
  const stripeSecret = env.STRIPE_SECRET_KEY?.trim();
  const secret = dedicatedSecret || stripeSecret;

  if (!secret) {
    throw new BillingManagementTokenError('Billing management is not configured');
  }

  return secret;
}

function getUnixTime(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new BillingManagementTokenError();
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeScopes(scopes: readonly string[]): BillingManagementScope[] {
  const validScopes = scopes.filter((scope): scope is BillingManagementScope => (
    scope === 'portal' || scope === 'cancel'
  ));
  return Array.from(new Set(validScopes));
}

function readClaims(value: unknown): BillingManagementTokenClaims {
  if (!value || typeof value !== 'object') {
    throw new BillingManagementTokenError();
  }

  const claims = value as Record<string, unknown>;
  const scopes = Array.isArray(claims.scopes)
    ? normalizeScopes(claims.scopes.filter((scope): scope is string => typeof scope === 'string'))
    : [];

  if (
    claims.version !== TOKEN_VERSION ||
    claims.audience !== TOKEN_AUDIENCE ||
    typeof claims.email !== 'string' ||
    !claims.email.includes('@') ||
    typeof claims.customerId !== 'string' ||
    !claims.customerId ||
    typeof claims.issuedAt !== 'number' ||
    !Number.isInteger(claims.issuedAt) ||
    typeof claims.expiresAt !== 'number' ||
    !Number.isInteger(claims.expiresAt) ||
    scopes.length === 0
  ) {
    throw new BillingManagementTokenError();
  }

  return {
    version: TOKEN_VERSION,
    audience: TOKEN_AUDIENCE,
    email: claims.email.toLowerCase().trim(),
    customerId: claims.customerId,
    scopes,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  };
}

export function issueBillingManagementToken({
  email,
  customerId,
  scopes = ['portal', 'cancel'],
  secret = getBillingManagementTokenSecret(),
  now = new Date(),
  ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
}: IssueBillingManagementTokenInput): { token: string; expiresAt: string } {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCustomerId = customerId.trim();
  const normalizedScopes = normalizeScopes(scopes);
  const issuedAt = getUnixTime(now);
  const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? Math.floor(ttlSeconds)
    : DEFAULT_TOKEN_TTL_SECONDS;

  if (!normalizedEmail.includes('@') || !normalizedCustomerId || normalizedScopes.length === 0) {
    throw new BillingManagementTokenError('Cannot issue billing management token');
  }

  const payload = encode({
    version: TOKEN_VERSION,
    audience: TOKEN_AUDIENCE,
    email: normalizedEmail,
    customerId: normalizedCustomerId,
    scopes: normalizedScopes,
    issuedAt,
    expiresAt: issuedAt + safeTtl,
  });

  const signature = sign(payload, secret);
  const expiresAt = new Date((issuedAt + safeTtl) * 1000).toISOString();

  return { token: `${payload}.${signature}`, expiresAt };
}

export function verifyBillingManagementToken(
  token: string,
  { scope, secret = getBillingManagementTokenSecret(), now = new Date() }: VerifyBillingManagementTokenOptions
): BillingManagementTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BillingManagementTokenError();
  }

  const [payload, signature] = parts;
  const expectedSignature = sign(payload, secret);
  if (!signaturesMatch(signature, expectedSignature)) {
    throw new BillingManagementTokenError();
  }

  const claims = readClaims(decode(payload));
  const currentTime = getUnixTime(now);
  if (claims.expiresAt <= currentTime || claims.issuedAt > currentTime + 60) {
    throw new BillingManagementTokenError('Billing management token has expired');
  }

  if (!claims.scopes.includes(scope)) {
    throw new BillingManagementTokenError('Billing management token scope is not allowed');
  }

  return claims;
}

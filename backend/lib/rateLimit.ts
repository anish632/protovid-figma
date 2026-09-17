/**
 * Rate limiting middleware for ProtoVid API
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (for production, use Redis)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getClientIdentifier(request: NextRequest): string {
  const account = request.headers.get('x-user-email')?.trim().toLowerCase();
  const anonymousId = request.headers.get('x-anonymous-id')?.trim();
  if (account) return `account:${account.slice(0, 255)}`;
  if (anonymousId) return `anonymous:${anonymousId.slice(0, 128)}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIP || 'unknown';
  
  // For authenticated requests, also include user context
  const userAgent = request.headers.get('user-agent') || '';
  return `${ip}:${userAgent.slice(0, 50)}`; // Truncate user agent
}

export function createRateLimit(config: RateLimitConfig, namespace = 'default') {
  return function rateLimit(request: NextRequest): NextResponse | null {
    const identifier = `${namespace}:${getClientIdentifier(request)}`;
    const now = Date.now();
    const record = rateLimitStore.get(identifier);

    if (!record || now > record.resetAt) {
      // First request or window expired
      rateLimitStore.set(identifier, {
        count: 1,
        resetAt: now + config.windowMs
      });
      return null; // Allow request
    }

    if (record.count >= config.max) {
      // Rate limit exceeded
      return NextResponse.json(
        { 
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetAt - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((record.resetAt - now) / 1000).toString(),
            'X-RateLimit-Limit': config.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(record.resetAt / 1000).toString()
          }
        }
      );
    }

    // Increment counter
    record.count++;
    
    return null; // Allow request
  };
}

// Predefined rate limiters
export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
}, 'general');

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 10 // 10 auth attempts per window
}, 'auth');

export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5 // 5 uploads per hour
}, 'upload');

export const mediaRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30 // Burst protection without blocking normal paid usage
}, 'media');

export const statsRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20 // 20 stats requests per window
}, 'stats');

// Helper to apply rate limiting to API routes
export function withRateLimit(
  rateLimit: (request: NextRequest) => NextResponse | null,
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async function(request: NextRequest) {
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}

/**
 * Input validation utilities for ProtoVid API
 */

import { z } from 'zod';

// Email validation schema
export const emailSchema = z.string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(254, 'Email too long') // RFC 5321 limit
  .transform(email => email.toLowerCase().trim());

// License key validation
export const licenseKeySchema = z.string()
  .min(1, 'License key is required')
  .max(255, 'License key too long')
  .regex(/^[a-zA-Z0-9@._-]+$/, 'Invalid license key format');

// API key validation
export const apiKeySchema = z.string()
  .min(32, 'API key must be at least 32 characters')
  .max(128, 'API key too long')
  .regex(/^[a-zA-Z0-9]+$/, 'API key must contain only alphanumeric characters');

// Event type validation
export const eventTypeSchema = z.enum([
  'plugin_load',
  'export',
  'checkout_start',
  'email_captured',
  'license_validation'
]);

// Plugin version validation
export const pluginVersionSchema = z.string()
  .regex(/^\d+\.\d+\.\d+$/, 'Invalid version format')
  .max(20, 'Version string too long');

// File size validation (10MB limit)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

// Content type validation for video uploads
export const ALLOWED_CONTENT_TYPES = [
  'video/avi',
  'video/x-msvideo',
  'application/octet-stream' // Some browsers send this for AVI
];

export function validateContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase());
}

// Sanitize error messages for client responses
export function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map(e => e.message).join(', ');
  }
  
  if (error instanceof Error) {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production') {
      return 'An error occurred while processing your request';
    }
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

// Validate and sanitize metadata objects
export const metadataSchema = z.record(z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
])).optional();

// Request validation schemas
export const trackingRequestSchema = z.object({
  email: emailSchema.optional(),
  eventType: eventTypeSchema,
  pluginVersion: pluginVersionSchema.optional(),
  metadata: metadataSchema
});

export const licenseValidationRequestSchema = z.object({
  licenseKey: licenseKeySchema
});

export const checkoutRequestSchema = z.object({
  email: emailSchema
});

export const exportCheckRequestSchema = z.object({
  email: emailSchema
});

// Rate limiting configuration
export const RATE_LIMITS = {
  // Per IP address limits
  general: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  auth: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 auth attempts per 15 minutes
  upload: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 uploads per hour
  stats: { windowMs: 5 * 60 * 1000, max: 20 }, // 20 stats requests per 5 minutes
} as const;

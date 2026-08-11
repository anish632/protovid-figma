export const BACKEND_MAX_UPLOAD_BYTES = 4_000_000;

export type PayloadPreflightStatus = 'ready' | 'near_limit' | 'too_large';

export interface PayloadPreflightResult {
  status: PayloadPreflightStatus;
  payloadBytes: number;
  maxBytes: number;
  remainingBytes: number;
}

export function getPayloadPreflight(
  payloadBytes: number,
  maxBytes = BACKEND_MAX_UPLOAD_BYTES,
): PayloadPreflightResult {
  const normalizedBytes = Number.isFinite(payloadBytes) ? Math.max(0, Math.round(payloadBytes)) : 0;
  const normalizedMaxBytes = Number.isFinite(maxBytes) && maxBytes > 0
    ? Math.round(maxBytes)
    : BACKEND_MAX_UPLOAD_BYTES;
  const status = normalizedBytes > normalizedMaxBytes
    ? 'too_large'
    : normalizedBytes >= normalizedMaxBytes * 0.9
      ? 'near_limit'
      : 'ready';

  return {
    status,
    payloadBytes: normalizedBytes,
    maxBytes: normalizedMaxBytes,
    remainingBytes: normalizedMaxBytes - normalizedBytes,
  };
}

export function formatPayloadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

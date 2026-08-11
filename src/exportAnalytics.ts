export type ExportAnalyticsValue = string | number | boolean | null;
export type ExportAnalyticsMetadata = Record<string, ExportAnalyticsValue>;

export function buildExportEventId(
  exportId: string | null | undefined,
  eventType: string,
  retryAttempt?: number | null,
): string | null {
  if (!exportId) return null;
  return `${exportId}:${eventType}:${retryAttempt ?? 'once'}`;
}

export function withExportContext(
  exportId: string | null | undefined,
  eventType: string,
  metadata: ExportAnalyticsMetadata = {},
): ExportAnalyticsMetadata {
  const eventId = typeof metadata.event_id === 'string'
    ? metadata.event_id
    : buildExportEventId(exportId, eventType, typeof metadata.retry_attempt === 'number' ? metadata.retry_attempt : null);
  return {
    ...(exportId ? { export_id: exportId } : {}),
    ...(eventId ? { event_id: eventId } : {}),
    ...metadata,
  };
}

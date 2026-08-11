/**
 * Usage Monitoring for ProtoVid Exports
 * Tracks high-volume users like Iva to monitor infrastructure costs
 */

import { recordEvent } from './events';

// High-priority users to monitor for usage spikes
const MONITORED_USERS = [
  'iva@clarion.agency'  // Free 3-month Pro access
];

// Usage thresholds for alerts
const USAGE_THRESHOLDS = {
  DAILY_WARNING: 20,    // Alert if >20 exports per day
  MONTHLY_WARNING: 100, // Alert if >100 exports per month
  DAILY_CRITICAL: 50,   // Critical alert if >50 per day
  MONTHLY_CRITICAL: 500 // Critical alert if >500 per month
};

interface ExportMetrics {
  videoSizeMB: number;
  processingTimeMs: number;
  resolution: string;
  frameCount: number;
  exportId?: string | null;
  projectId?: string | null;
  pluginVersion?: string | null;
}

function normalizedEmail(email: string): string | null {
  const normalized = email.toLowerCase().trim();
  return normalized && normalized !== 'anonymous' ? normalized : null;
}

export async function trackExportUsage(
  email: string, 
  metrics: ExportMetrics,
  anonymousId?: string | null,
): Promise<void> {
  try {
    // Always record the export event for analytics
    await recordEvent(normalizedEmail(email), 'video_export_completed', {
      ...(metrics.exportId ? { export_id: metrics.exportId, event_id: `${metrics.exportId}:video_export_completed` } : {}),
      ...(metrics.projectId ? { project_id: metrics.projectId } : {}),
      video_size_mb: metrics.videoSizeMB,
      processing_time_ms: metrics.processingTimeMs,
      resolution: metrics.resolution,
      frame_count: metrics.frameCount,
      is_monitored_user: MONITORED_USERS.includes(email.toLowerCase()),
      ...(anonymousId ? { anonymousId } : {}),
    }, metrics.pluginVersion || 'backend');

    // Enhanced monitoring for special users
    if (MONITORED_USERS.includes(email.toLowerCase())) {
      await monitorHighVolumeUser(email, metrics);
    }

  } catch (error) {
    console.error('Usage tracking error:', error);
    // Don't fail the export if monitoring fails
  }
}

async function monitorHighVolumeUser(
  email: string, 
  metrics: ExportMetrics
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  // Get recent usage counts (this would ideally query a proper metrics DB)
  // For now, we'll record events and can analyze logs later
  await recordEvent(email, 'high_volume_user_export', {
    date: today,
    month: thisMonth,
    video_size_mb: metrics.videoSizeMB,
    processing_time_ms: metrics.processingTimeMs,
    resolution: metrics.resolution,
    frame_count: metrics.frameCount,
    threshold_check: 'logged_for_analysis'
  });

  // In a production system, you'd query actual usage here and send alerts
  // For now, this creates a clear audit trail in the events log
  
  // Log high usage patterns
  if (metrics.videoSizeMB > 50) {
    console.warn(`Large export for monitored user ${email}: ${metrics.videoSizeMB}MB`);
  }

  if (metrics.processingTimeMs > 25000) {
    console.warn(`Long processing time for ${email}: ${metrics.processingTimeMs}ms`);
  }
}

// Utility to check if user should be monitored
export function shouldMonitorUser(email: string): boolean {
  return MONITORED_USERS.includes(email.toLowerCase());
}

// Get usage summary for monitored users (for manual checking)
export async function getUsageSummary(email: string): Promise<{
  isMonitored: boolean;
  recommendations: string[];
}> {
  const isMonitored = shouldMonitorUser(email);
  
  if (!isMonitored) {
    return {
      isMonitored: false,
      recommendations: []
    };
  }

  // Return monitoring status and recommendations
  return {
    isMonitored: true,
    recommendations: [
      'Check Vercel function usage dashboard for bandwidth/compute costs',
      'Review recent video_export_completed events for this user',
      'Consider adding rate limiting if usage exceeds thresholds',
      'Monitor for unusual patterns (very large files, long processing times)'
    ]
  };
}

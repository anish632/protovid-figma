import { neon } from '@neondatabase/serverless';
import { getBillingManagementEmailConfig } from './billingManagementEmail';
import { getBillingEmailPhase, type BillingEmailPhase, type BillingState } from './billingState';
import type { Subscription } from './storage';

export function billingEmailContent(phase: BillingEmailPhase, state: BillingState, appUrl: string) {
  const deadline = state.graceEndsAt ? new Date(state.graceEndsAt).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  }) : '';
  const verify = state.kind === 'authentication_required';
  const action = verify ? 'Complete your bank’s verification' : 'Review your payment method and unpaid invoice';
  const messages: Record<BillingEmailPhase, { subject: string; text: string; label: string }> = {
    access_ending: { subject: 'Your ProtoVid paid access ends soon',
      text: `Your renewal is still unpaid. ${action} to keep paid features. Your grace period ends on ${deadline}; after that, you can still use Free.`, label: verify ? 'Verify payment' : 'Fix payment' },
    access_paused: { subject: 'Your ProtoVid paid features are paused',
      text: `Your renewal has not completed, so your account now has Free access. ${action} to resolve the outstanding renewal.`, label: verify ? 'Verify payment' : 'Fix payment' },
    canceled: { subject: 'Your ProtoVid subscription has ended',
      text: 'Your paid subscription has ended and your account now has Free access. You can review any outstanding invoice in billing. Paying an old invoice does not automatically restart a canceled subscription. To use paid features again, return to ProtoVid and start a new subscription.', label: 'Review billing' },
    recovered: { subject: 'Your ProtoVid paid access is restored',
      text: 'Your subscription is active again and paid features are available. Reopen ProtoVid to refresh your access.', label: 'Manage subscription' },
  };
  return { ...messages[phase], url: `${appUrl.replace(/\/$/, '')}/account` };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

/** Persistent dedupe plus provider idempotency makes webhook/cron retries safe. */
export async function deliverBillingNotification(subscription: Subscription) {
  const state = subscription.billingState;
  if (!state) return 'not_due';
  const phase = getBillingEmailPhase(state);
  if (!phase) return 'not_due';
  const key = `${state.subscriptionId}:${state.invoiceId || state.startedAt}:${phase}`;
  const sql = neon(process.env.NEON_DATABASE_URL!);
  await sql`INSERT INTO protovid_billing_notifications (notification_key, email, phase)
    VALUES (${key}, ${subscription.email}, ${phase}) ON CONFLICT DO NOTHING`;
  const config = getBillingManagementEmailConfig();
  if (!config) return 'sender_not_configured';
  // A failed delivery beyond the provider's 24-hour idempotency window needs
  // manual review; don't risk sending a duplicate after an ambiguous timeout.
  const claims = await sql`UPDATE protovid_billing_notifications
    SET status = 'sending', attempted_at = COALESCE(attempted_at, CURRENT_TIMESTAMP)
    WHERE notification_key = ${key} AND (status = 'pending' OR
      (status = 'retry' AND attempted_at > CURRENT_TIMESTAMP - INTERVAL '23 hours'))
    RETURNING notification_key`;
  if (!claims.length) return 'already_handled';
  const content = billingEmailContent(phase, state, config.appUrl);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ from: config.from, to: [subscription.email], reply_to: config.supportEmail,
        subject: content.subject, text: `${content.text}\n\n${content.label}: ${content.url}\n\nQuestions? Reply to this email.`,
        html: `<p>${escapeHtml(content.text)}</p><p><a href="${escapeHtml(content.url)}">${escapeHtml(content.label)}</a></p><p>Questions? Reply to this email.</p>` }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    const result = await response.json();
    await sql`UPDATE protovid_billing_notifications SET status = 'sent', sent_at = CURRENT_TIMESTAMP,
      provider_id = ${result.id || null}, last_error = NULL WHERE notification_key = ${key}`;
    return 'sent';
  } catch (error) {
    await sql`UPDATE protovid_billing_notifications SET status = 'retry', last_error = ${error instanceof Error ? error.message : 'Delivery failed'}
      WHERE notification_key = ${key}`;
    throw error;
  }
}

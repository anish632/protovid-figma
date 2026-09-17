export interface BillingState {
  kind: 'payment_failed' | 'authentication_required' | 'canceled' | 'recovered';
  subscriptionId: string;
  invoiceId?: string;
  startedAt: string;
  graceEndsAt?: string;
}

export interface BillingNotice {
  title: string;
  message: string;
  actionLabel: string;
}

export function isInBillingGrace(state: BillingState | null | undefined, now = new Date()): boolean {
  return Boolean(state && ['payment_failed', 'authentication_required'].includes(state.kind)
    && state.graceEndsAt && Date.parse(state.graceEndsAt) > now.getTime());
}

export function getBillingNotice(status: string, state?: BillingState | null, now = new Date()): BillingNotice | null {
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return {
      title: 'Your paid subscription has ended',
      message: 'You’re now on Free. Review any outstanding invoice in billing. Paying an old invoice does not automatically restart a canceled subscription.',
      actionLabel: 'Review billing',
    };
  }
  if (status !== 'past_due' && status !== 'incomplete') return null;
  const authentication = state?.kind === 'authentication_required';
  const action = authentication ? 'Complete your bank’s verification to finish your renewal.' : 'Review your payment method and unpaid invoice to finish your renewal.';
  const access = isInBillingGrace(state, now)
    ? `Paid features stay available until ${new Date(state!.graceEndsAt!).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}.`
    : 'Paid features are paused. You can still use Free.';
  return {
    title: authentication ? 'Bank verification needed' : 'Your renewal needs attention',
    message: `${action} ${access}`,
    actionLabel: authentication ? 'Verify payment' : 'Fix payment',
  };
}

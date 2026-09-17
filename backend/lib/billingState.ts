import { isInBillingGrace, type BillingState } from './billingNotice';
export { isInBillingGrace, type BillingState };

// Anchor to the invoice, never to a retry/webhook delivery time.
export function deriveBillingState(input: {
  status: string; subscriptionId: string; invoiceId?: string;
  invoiceCreated?: number; canceledAt?: number; authenticationRequired?: boolean;
  establishedRenewal: boolean; previous?: BillingState | null;
}, now = new Date()): BillingState | null {
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(input.status)) {
    return { kind: 'canceled', subscriptionId: input.subscriptionId,
      startedAt: input.canceledAt ? new Date(input.canceledAt * 1000).toISOString() : input.previous?.startedAt || now.toISOString() };
  }
  if (['active', 'trialing'].includes(input.status)) {
    if (input.previous && ['payment_failed', 'authentication_required'].includes(input.previous.kind)
      && input.previous.subscriptionId === input.subscriptionId) {
      return { ...input.previous, kind: 'recovered', startedAt: now.toISOString(), graceEndsAt: undefined };
    }
    return input.previous?.kind === 'recovered' ? input.previous : null;
  }
  if (!['past_due', 'incomplete'].includes(input.status)) return null;
  const startedAt = input.invoiceCreated ? new Date(input.invoiceCreated * 1000).toISOString() : now.toISOString();
  return { kind: input.authenticationRequired ? 'authentication_required' : 'payment_failed',
    subscriptionId: input.subscriptionId, invoiceId: input.invoiceId, startedAt,
    graceEndsAt: input.status === 'past_due' && input.establishedRenewal && input.invoiceCreated
      ? new Date(input.invoiceCreated * 1000 + 7 * 86400000).toISOString() : undefined };
}

export type BillingEmailPhase = 'access_ending' | 'access_paused' | 'canceled' | 'recovered';
// Stripe owns first-failure/authentication emails and payment reminders. ProtoVid
// sends only access changes plus one advance deadline warning.
export function getBillingEmailPhase(state: BillingState, now = new Date()): BillingEmailPhase | null {
  if (state.kind === 'canceled' || state.kind === 'recovered') return state.kind;
  if (!isInBillingGrace(state, now)) return 'access_paused';
  if (Date.parse(state.graceEndsAt!) - now.getTime() <= 2 * 86400000) return 'access_ending';
  return null;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveBillingState, getBillingEmailPhase } from './billingState';
import { buildEntitlementResponse } from './entitlement';
import { billingEmailContent } from './billingNotification';
import { getBillingNotice } from '../../src/billingNotice';
import { normalizeEntitlementResponse } from '../../src/entitlement';
import { isPremiumSubscription } from './plans';

const start = new Date('2026-09-01T12:00:00Z');
const input = { status: 'past_due', subscriptionId: 'sub_existing', invoiceId: 'in_renewal',
  invoiceCreated: start.getTime() / 1000, establishedRenewal: true };
const state = deriveBillingState(input, start)!;
const subscriber = { email: 'test@example.com', tier: 'free' as const, status: 'past_due' as const,
  stripeSubscriptionId: 'sub_existing', billingState: state, exportsThisMonth: 1, lastResetMonth: '2026-09' };

test('existing subscriber retains full export access until exact seven-day deadline', () => {
  const before = buildEntitlementResponse(subscriber.email, subscriber, new Date('2026-09-08T11:59:59Z'));
  assert.equal(before.isPaid, true);
  assert.equal(before.watermarkRequired, false);
  assert.equal(before.canExport, true);
  assert.equal(before.subscriptionStatus, 'past_due');
  assert.match(before.billingNotice!.message, /Sep 8, 2026/);
  const after = buildEntitlementResponse(subscriber.email, subscriber, new Date('2026-09-08T12:00:00Z'));
  assert.equal(after.isPaid, false);
  assert.equal(after.canExport, false);
  assert.match(after.billingNotice!.message, /paused/);
});

test('late retries never reset the grace window', () => {
  assert.equal(deriveBillingState({ ...input, previous: state }, new Date('2026-10-01'))!.graceEndsAt, '2026-09-08T12:00:00.000Z');
});

test('new/unpaid trial accounts and first invoices do not receive grace', () => {
  for (const override of [{ establishedRenewal: false }, { status: 'incomplete' }, { invoiceCreated: undefined }]) {
    const trialState = deriveBillingState({ ...input, ...override }, start)!;
    assert.equal(trialState.graceEndsAt, undefined);
    assert.equal(isPremiumSubscription({ ...subscriber, billingState: trialState }, start), false);
  }
});

test('grace from a different subscription never grants access', () => {
  assert.equal(isPremiumSubscription({ ...subscriber, stripeSubscriptionId: 'sub_new' }, start), false);
});

test('authentication uses a verification action and survives frontend normalization', () => {
  const auth = deriveBillingState({ ...input, authenticationRequired: true }, start)!;
  const entitlement = buildEntitlementResponse(subscriber.email, { ...subscriber, billingState: auth }, start);
  assert.equal(normalizeEntitlementResponse(entitlement)!.billingNotice!.actionLabel, 'Verify payment');
});

test('cancellation revokes grace and preserves billing reason for free accounts', () => {
  const canceled = deriveBillingState({ ...input, status: 'canceled', previous: state }, start)!;
  const entitlement = buildEntitlementResponse(subscriber.email, { ...subscriber, status: 'canceled', billingState: canceled }, start);
  assert.equal(entitlement.isPaid, false);
  assert.equal(entitlement.subscriptionStatus, 'canceled');
  assert.match(entitlement.billingNotice!.message, /does not automatically restart/);
});

test('successful recovery clears banner and emits one stable recovery state', () => {
  const recovered = deriveBillingState({ ...input, status: 'active', previous: state }, start)!;
  assert.equal(getBillingNotice('active', recovered), null);
  assert.equal(recovered.kind, 'recovered');
  assert.deepEqual(deriveBillingState({ ...input, status: 'active', previous: recovered }, new Date('2026-09-10')), recovered);
});

test('access emails do not duplicate initial Stripe reminders; deadline warning precedes cutoff', () => {
  assert.equal(getBillingEmailPhase(state, start), null);
  assert.equal(getBillingEmailPhase(state, new Date('2026-09-06T12:00:00Z')), 'access_ending');
  assert.equal(getBillingEmailPhase(state, new Date('2026-09-08T12:00:00Z')), 'access_paused');
  const content = billingEmailContent('access_ending', state, 'https://protovid.example');
  assert.match(content.text, /September 8, 2026/);
  assert.equal(content.url, 'https://protovid.example/account');
});

test('free users with no billing issue see no warning', () => {
  assert.equal(getBillingNotice('active'), null);
});

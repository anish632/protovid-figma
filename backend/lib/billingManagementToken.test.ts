import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BillingManagementTokenError,
  issueBillingManagementToken,
  verifyBillingManagementToken,
} from './billingManagementToken.js';

const secret = 'test-only-management-token-secret';
const issuedAt = new Date('2026-07-11T12:00:00.000Z');

test('a completed-checkout management token is scoped to the customer and action', () => {
  const { token, expiresAt } = issueBillingManagementToken({
    email: ' Buyer@Example.com ',
    customerId: 'cus_123',
    secret,
    now: issuedAt,
    ttlSeconds: 600,
  });

  const claims = verifyBillingManagementToken(token, {
    scope: 'portal',
    secret,
    now: new Date('2026-07-11T12:05:00.000Z'),
  });

  assert.equal(claims.email, 'buyer@example.com');
  assert.equal(claims.customerId, 'cus_123');
  assert.deepEqual(claims.scopes, ['portal', 'cancel']);
  assert.equal(expiresAt, '2026-07-11T12:10:00.000Z');
});

test('a portal-only token cannot cancel a subscription', () => {
  const { token } = issueBillingManagementToken({
    email: 'buyer@example.com',
    customerId: 'cus_123',
    scopes: ['portal'],
    secret,
    now: issuedAt,
  });

  assert.throws(
    () => verifyBillingManagementToken(token, { scope: 'cancel', secret, now: issuedAt }),
    BillingManagementTokenError
  );
});

test('management tokens reject tampering and expiration', () => {
  const { token } = issueBillingManagementToken({
    email: 'buyer@example.com',
    customerId: 'cus_123',
    secret,
    now: issuedAt,
    ttlSeconds: 60,
  });

  assert.throws(
    () => verifyBillingManagementToken(`${token}x`, { scope: 'portal', secret, now: issuedAt }),
    BillingManagementTokenError
  );
  assert.throws(
    () => verifyBillingManagementToken(token, {
      scope: 'portal',
      secret,
      now: new Date('2026-07-11T12:01:00.000Z'),
    }),
    BillingManagementTokenError
  );
});

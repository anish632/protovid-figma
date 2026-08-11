/**
 * Revenue helpers shared by the admin endpoint and the offline audit script.
 *
 * Stripe keeps the original charge amount after a refund. `amount_refunded`
 * is therefore the source of truth for both full and partial refunds. Counting
 * only non-refunded charges and then subtracting refunds would subtract a full
 * refund twice.
 */

export interface ChargeRevenueInput {
  paid: boolean;
  amount: number;
  amount_refunded?: number | null;
  refunded?: boolean;
}

export interface ChargeRevenueSummary {
  paidChargeCount: number;
  refundedChargeCount: number;
  fullyRefundedChargeCount: number;
  partiallyRefundedChargeCount: number;
  grossRevenueCents: number;
  refundedRevenueCents: number;
  netRevenueCents: number;
}

/**
 * Returns a bounded refund amount even for incomplete historical payloads.
 * Old Stripe-shaped records may not expose `amount_refunded`; for those, the
 * boolean `refunded` still reliably represents a full refund.
 */
export function getRefundedAmountCents(charge: ChargeRevenueInput): number {
  const amount = Number.isFinite(charge.amount) ? Math.max(0, charge.amount) : 0;
  const reportedRefund = charge.amount_refunded;
  const refund = Number.isFinite(reportedRefund)
    ? Math.max(0, reportedRefund as number)
    : charge.refunded
      ? amount
      : 0;

  return Math.min(refund, amount);
}

export function summarizeChargeRevenue(
  charges: readonly ChargeRevenueInput[]
): ChargeRevenueSummary {
  const paidCharges = charges.filter(charge => charge.paid);

  const grossRevenueCents = paidCharges.reduce(
    (total, charge) => total + Math.max(0, charge.amount),
    0
  );

  const refundAmounts = paidCharges.map(getRefundedAmountCents);
  const refundedRevenueCents = refundAmounts.reduce(
    (total, amount) => total + amount,
    0
  );

  const refundedChargeCount = refundAmounts.filter(amount => amount > 0).length;
  const fullyRefundedChargeCount = paidCharges.filter(
    (charge, index) => charge.amount > 0 && refundAmounts[index] >= charge.amount
  ).length;

  return {
    paidChargeCount: paidCharges.length,
    refundedChargeCount,
    fullyRefundedChargeCount,
    partiallyRefundedChargeCount: refundedChargeCount - fullyRefundedChargeCount,
    grossRevenueCents,
    refundedRevenueCents,
    netRevenueCents: grossRevenueCents - refundedRevenueCents,
  };
}

import fs from 'node:fs';
import { syncBillingRecovery } from '../lib/billingRecovery';
import { buildEntitlementResponse } from '../lib/entitlement';
for (const line of fs.readFileSync('.env.billing-recovery.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n').trim();
}
async function main() {
  for (const email of ['adidush28@gmail.com', 'arjun.s.s.murthy@gmail.com']) {
    const subscription = await syncBillingRecovery(email);
    const entitlement = buildEntitlementResponse(email, subscription);
    console.log(JSON.stringify({ email, tier: subscription.tier, status: subscription.status, billingState: subscription.billingState,
      isPaid: entitlement.isPaid, billingNotice: entitlement.billingNotice }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

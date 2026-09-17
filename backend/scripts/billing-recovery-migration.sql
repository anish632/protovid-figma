-- Additive migration; run before deploying billing recovery code.
ALTER TABLE protovid_subscriptions ADD COLUMN IF NOT EXISTS billing_state JSONB;
CREATE TABLE IF NOT EXISTS protovid_billing_notifications (
  notification_key TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  provider_id TEXT,
  last_error TEXT
);

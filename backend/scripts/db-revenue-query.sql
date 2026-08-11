-- ProtoVid Database Revenue & Usage Queries
-- Run these against your Neon Postgres database

-- ============================================
-- 1. OVERALL METRICS
-- ============================================

-- Total subscriptions
SELECT 
  COUNT(*) as total_subscriptions,
  COUNT(*) FILTER (WHERE tier = 'pro') as pro_subscriptions,
  COUNT(*) FILTER (WHERE tier = 'free') as free_subscriptions,
  COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
  COUNT(*) FILTER (WHERE status = 'canceled') as canceled_subscriptions,
  COUNT(*) FILTER (WHERE status = 'trialing') as trial_subscriptions
FROM protovid_subscriptions;

-- Total users (unique emails)
SELECT COUNT(DISTINCT email) as total_unique_users
FROM protovid_subscriptions;

-- ============================================
-- 2. REVENUE TRACKING
-- ============================================

-- Payment confirmed events (successful payments)
SELECT 
  COUNT(*) as total_payment_events,
  COUNT(DISTINCT email) as unique_paying_users,
  MIN(created_at) as first_payment_date,
  MAX(created_at) as last_payment_date
FROM protovid_events
WHERE event_type = 'payment_confirmed';

-- Subscription started events
SELECT 
  COUNT(*) as total_subscription_starts,
  COUNT(DISTINCT email) as unique_subscribers,
  MIN(created_at) as first_subscription_date,
  MAX(created_at) as last_subscription_date
FROM protovid_events
WHERE event_type = 'subscription_started';

-- Checkout completed events
SELECT 
  COUNT(*) as total_checkouts_completed,
  COUNT(DISTINCT email) as unique_checkout_users
FROM protovid_events
WHERE event_type = 'checkout_completed';

-- ============================================
-- 3. FUNNEL ANALYSIS (Last 30 days)
-- ============================================

-- Canonical actors prefer the plugin's stable anonymous ID. The identity map
-- joins later Stripe/email events back to the same actor once email is saved.
WITH latest_anonymous_identity AS (
  SELECT DISTINCT ON (LOWER(email))
    LOWER(email) AS normalized_email,
    NULLIF(metadata::jsonb->>'anonymousId', '') AS anonymous_id
  FROM protovid_events
  WHERE email IS NOT NULL
    AND NULLIF(metadata::jsonb->>'anonymousId', '') IS NOT NULL
  ORDER BY LOWER(email), created_at DESC
),
recent_events AS (
  SELECT
    event.event_type,
    event.metadata::jsonb AS metadata,
    COALESCE(
      NULLIF(event.metadata::jsonb->>'anonymousId', ''),
      identity.anonymous_id,
      NULLIF(LOWER(event.email), '')
    ) AS actor_id,
    CASE
      WHEN event.event_type = 'upsell_card_viewed' THEN 'upsell'
      WHEN event.event_type = 'paywall_viewed'
        AND (
          COALESCE(event.metadata::jsonb->>'reason', '') IN ('free_limit_hit', 'free_limit', 'trial_expired')
          OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('free_limit_ui_shown', 'free_limit_reached', 'trial_expired')
        ) THEN 'quota'
      WHEN event.event_type = 'paywall_viewed'
        AND (
          COALESCE(event.metadata::jsonb->>'reason', '') IN ('upsell', 'upsell_card')
          OR COALESCE(event.metadata::jsonb->>'source', '') IN ('upsell_card', 'post_export_upsell')
          OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('upsell_card_shown', 'post_export_upsell')
        ) THEN 'upsell'
      WHEN event.event_type = 'paywall_viewed' THEN 'legacy_ambiguous'
      ELSE NULL
    END AS monetization_surface
  FROM protovid_events event
  LEFT JOIN latest_anonymous_identity identity
    ON LOWER(event.email) = identity.normalized_email
  WHERE event.created_at >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'session_opened') as session_opened_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'prototype_detected') as prototype_detected_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'prototype_path_selected') as prototype_path_selected_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_started') as export_started_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_completed') as export_completed_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'download_clicked') as download_clicked_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'upsell') as upsell_card_viewed_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'quota') as quota_paywall_viewed_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'legacy_ambiguous') as legacy_ambiguous_paywall_viewed_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upgrade_clicked') as upgrade_clicked_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_created') as checkout_created_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed_users
FROM recent_events;

-- Canonical conversion rates. Do not use raw paywall views as an upsell or
-- quota denominator; use upgrade-clicked and server-created checkout sessions.
WITH latest_anonymous_identity AS (
  SELECT DISTINCT ON (LOWER(email))
    LOWER(email) AS normalized_email,
    NULLIF(metadata::jsonb->>'anonymousId', '') AS anonymous_id
  FROM protovid_events
  WHERE email IS NOT NULL
    AND NULLIF(metadata::jsonb->>'anonymousId', '') IS NOT NULL
  ORDER BY LOWER(email), created_at DESC
),
recent_events AS (
  SELECT
    event.event_type,
    COALESCE(
      NULLIF(event.metadata::jsonb->>'anonymousId', ''),
      identity.anonymous_id,
      NULLIF(LOWER(event.email), '')
    ) AS actor_id
  FROM protovid_events event
  LEFT JOIN latest_anonymous_identity identity
    ON LOWER(event.email) = identity.normalized_email
  WHERE event.created_at >= CURRENT_DATE - INTERVAL '30 days'
),
funnel AS (
  SELECT
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'session_opened') as session_opened,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'prototype_detected') as prototype_detected,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_started') as export_started,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_completed') as export_completed,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'download_clicked') as download_clicked,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upgrade_clicked') as upgrade_clicked,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_created') as checkout_created,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened,
    COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed
  FROM recent_events
)
SELECT
  *,
  ROUND((prototype_detected::numeric / NULLIF(session_opened, 0) * 100), 2) as prototype_detection_pct,
  ROUND((export_completed::numeric / NULLIF(export_started, 0) * 100), 2) as export_completion_pct,
  ROUND((download_clicked::numeric / NULLIF(export_completed, 0) * 100), 2) as download_pct,
  ROUND((checkout_created::numeric / NULLIF(upgrade_clicked, 0) * 100), 2) as checkout_creation_pct,
  ROUND((checkout_opened::numeric / NULLIF(checkout_created, 0) * 100), 2) as checkout_open_pct,
  ROUND((payment_confirmed::numeric / NULLIF(checkout_created, 0) * 100), 2) as paid_checkout_conversion_pct
FROM funnel;

-- ============================================
-- 4. EXPORT USAGE
-- ============================================

-- Total exports by month
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_exports,
  COUNT(DISTINCT email) as unique_exporters,
  COUNT(*) FILTER (WHERE metadata::jsonb->>'resolution' = '720p') as exports_720p,
  COUNT(*) FILTER (WHERE metadata::jsonb->>'resolution' = '1080p') as exports_1080p,
  COUNT(*) FILTER (WHERE metadata::jsonb->>'resolution' = '4K') as exports_4k
FROM protovid_events
WHERE event_type IN ('export_completed', 'export_success', 'video_export_completed')
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Exports by user (top users)
SELECT 
  email,
  COUNT(*) as export_count,
  MIN(created_at) as first_export,
  MAX(created_at) as last_export
FROM protovid_events
WHERE event_type IN ('export_completed', 'export_success')
GROUP BY email
ORDER BY export_count DESC
LIMIT 20;

-- Export success vs failure
SELECT 
  event_type,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM protovid_events
WHERE event_type IN ('export_success', 'export_completed', 'export_failed', 'export_safe_retry_succeeded', 'export_safe_retry_failed')
GROUP BY event_type;

-- ============================================
-- 5. FREE TIER USAGE
-- ============================================

-- Free exports this month
SELECT 
  COUNT(*) as free_exports_this_month,
  COUNT(DISTINCT email) as free_users_this_month,
  SUM(exports_this_month) as total_free_exports_recorded
FROM protovid_subscriptions
WHERE tier = 'free' 
  AND last_reset_month = DATE_TRUNC('month', CURRENT_DATE)::text;

-- Users at free limit
SELECT 
  COUNT(*) as users_at_limit
FROM protovid_subscriptions
WHERE tier = 'free' 
  AND exports_this_month >= 3
  AND last_reset_month = DATE_TRUNC('month', CURRENT_DATE)::text;

-- ============================================
-- 6. RECENT ACTIVITY (Last 7 days)
-- ============================================

SELECT 
  DATE(created_at) as date,
  event_type,
  COUNT(*) as count,
  COUNT(DISTINCT email) as unique_users
FROM protovid_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), event_type
ORDER BY date DESC, count DESC;

-- Daily active users
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT email) as dau
FROM protovid_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- 7. STRIPE WEBHOOK EVENTS
-- ============================================

-- Webhook events by type
SELECT 
  event_type,
  COUNT(*) as count
FROM protovid_events
WHERE plugin_version = 'webhook'
GROUP BY event_type
ORDER BY count DESC;

-- ============================================
-- 8. PRICING EXPERIMENT RESULTS
-- ============================================

-- Pricing variants: separate the non-blocking upsell from a true quota wall.
WITH latest_anonymous_identity AS (
  SELECT DISTINCT ON (LOWER(email))
    LOWER(email) AS normalized_email,
    NULLIF(metadata::jsonb->>'anonymousId', '') AS anonymous_id
  FROM protovid_events
  WHERE email IS NOT NULL
    AND NULLIF(metadata::jsonb->>'anonymousId', '') IS NOT NULL
  ORDER BY LOWER(email), created_at DESC
),
recent_events AS (
  SELECT
    event.event_type,
    event.metadata::jsonb AS metadata,
    COALESCE(
      NULLIF(event.metadata::jsonb->>'anonymousId', ''),
      identity.anonymous_id,
      NULLIF(LOWER(event.email), '')
    ) AS actor_id,
    COALESCE(event.metadata::jsonb->>'pricingVariant', event.metadata::jsonb->>'pricing_variant', 'unknown') AS pricing_variant,
    CASE
      WHEN event.event_type = 'upsell_card_viewed' THEN 'upsell'
      WHEN event.event_type = 'paywall_viewed'
        AND (
          COALESCE(event.metadata::jsonb->>'reason', '') IN ('free_limit_hit', 'free_limit', 'trial_expired')
          OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('free_limit_ui_shown', 'free_limit_reached', 'trial_expired')
        ) THEN 'quota'
      WHEN event.event_type = 'paywall_viewed'
        AND (
          COALESCE(event.metadata::jsonb->>'reason', '') IN ('upsell', 'upsell_card')
          OR COALESCE(event.metadata::jsonb->>'source', '') IN ('upsell_card', 'post_export_upsell')
          OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('upsell_card_shown', 'post_export_upsell')
        ) THEN 'upsell'
      WHEN event.event_type = 'paywall_viewed' THEN 'legacy_ambiguous'
      ELSE NULL
    END AS monetization_surface
  FROM protovid_events event
  LEFT JOIN latest_anonymous_identity identity
    ON LOWER(event.email) = identity.normalized_email
  WHERE event.created_at >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT
  pricing_variant,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'pricing_variant_assigned') as assigned_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'upsell') as upsell_card_viewed_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'quota') as quota_paywall_viewed_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'legacy_ambiguous') as legacy_ambiguous_paywall_viewed_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upgrade_clicked') as upgrade_clicked_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_created') as checkout_created_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened_users,
  COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed_users,
  COALESCE(MAX((metadata->>'amountCents')::integer), MAX((metadata->>'amount_cents')::integer), 0) as amount_cents,
  COALESCE(MAX(metadata->>'priceLabel'), MAX(metadata->>'price_label'), '') as price_label
FROM recent_events
GROUP BY pricing_variant
ORDER BY payment_confirmed_users DESC;

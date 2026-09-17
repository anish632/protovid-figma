-- Read-only. UTC, half-open weeks. Fix as_of to reproduce a published report.
-- Identity matches existing stats semantics; shared emails/latest mapping can merge devices.
WITH params AS (SELECT CURRENT_TIMESTAMP AS as_of),
identity AS (
 SELECT DISTINCT ON (lower(email)) lower(email) email, metadata::jsonb->>'anonymousId' aid
 FROM protovid_events WHERE email IS NOT NULL AND nullif(metadata::jsonb->>'anonymousId','') IS NOT NULL
 ORDER BY lower(email),created_at DESC
), events AS (
 SELECT event_type,created_at,metadata::jsonb m,
 coalesce(nullif(metadata::jsonb->>'anonymousId',''),i.aid,nullif(lower(p.email),'')) actor
 FROM protovid_events p LEFT JOIN identity i ON lower(p.email)=i.email
), firsts AS (
 SELECT actor,min(created_at) FILTER(WHERE event_type='session_opened') first_session,
 min(created_at) FILTER(WHERE event_type='export_completed') first_export
 FROM events WHERE actor IS NOT NULL GROUP BY actor
), cohort AS (
 SELECT f.*, (SELECT min(created_at) FROM events e WHERE e.actor=f.actor AND e.event_type='export_completed'
 AND e.created_at>=f.first_session AND e.created_at<f.first_session+interval '7 days') activated_at
 FROM firsts f,params p WHERE first_session>=p.as_of-interval '37 days' AND first_session<p.as_of-interval '7 days'
), upgrades AS (
 SELECT actor,min(created_at) clicked_at FROM events,params p WHERE event_type='upgrade_clicked'
 AND created_at>=p.as_of-interval '37 days' AND created_at<p.as_of-interval '7 days' AND actor IS NOT NULL GROUP BY actor
), joined AS (
 SELECT u.*, (SELECT min(created_at) FROM events e WHERE e.actor=u.actor AND event_type='checkout_created'
 AND e.created_at>=u.clicked_at AND e.created_at<u.clicked_at+interval '7 days') checkout_at FROM upgrades u
)
SELECT json_build_object('as_of',(SELECT as_of FROM params),
 'matured_first_session_cohorts',(SELECT json_agg(t) FROM (SELECT date_trunc('week',first_session) week,
 count(*) actors,count(activated_at) first_exports_within_7d FROM cohort GROUP BY 1 ORDER BY 1) t),
 'ordered_upgrade_cohort',(SELECT json_build_object('upgraders',count(*),'checkout_creators',count(checkout_at),
 'confirmed_after_checkout',count(*) FILTER(WHERE checkout_at IS NOT NULL AND EXISTS(SELECT 1 FROM events e
 WHERE e.actor=joined.actor AND e.event_type='payment_confirmed' AND e.created_at>=joined.checkout_at
 AND e.created_at<joined.clicked_at+interval '7 days'))) FROM joined),
 'matured_repeat_cohort',(SELECT json_build_object('first_exporters',count(*),'returned_days_1_to_7',count(*) FILTER(WHERE EXISTS(
 SELECT 1 FROM events e WHERE e.actor=f.actor AND event_type='export_completed'
 AND e.created_at>=f.first_export+interval '1 day' AND e.created_at<f.first_export+interval '8 days')))
 FROM firsts f,params p WHERE first_export>=p.as_of-interval '38 days' AND first_export<p.as_of-interval '8 days'));

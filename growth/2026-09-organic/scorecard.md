# Attribution and weekly scorecard

Report each Monday for the previous complete UTC week, with retrieval timestamp and fixed as-of time. Report counts beside rates; use “unavailable” rather than zero for missing instrumentation. Keep trailing-30-day diagnostics separate from weekly and matured cohorts. Exclude known QA/test actors where explicitly tagged; historic untagged QA remains a limitation.

## September 7 baseline (trailing 30 days unless stated)

| Measure | Count / denominator | Rate / amount | Evidence and caveat |
| --- | --- | --- | --- |
| Qualified website visits | unavailable | unavailable | No verified engaged-visitor instrumentation/source report |
| Plugin session actors | 298 | — | stats.json; actors, not people/install counts |
| Successful exporters / session actors | 160 / 298 | 53.7% | Aggregate, not ordered funnel |
| Successful exporters / export starters | 160 / 168 | 95.2% | Aggregate actor ratio |
| Checkout creators / upgrade clickers | 3 / 23 | 13.0% | Aggregate; main purchase gap |
| Payment actors / checkout creators | 1 / 3 | 33.3% | Event identity; tiny sample |
| Matured ordered upgrade cohort | 3 / 17 checkout; 1 / 3 paid | 17.6%; 33.3% | Each upgrade has seven-day observation; SQL joins actor and time |
| First export within seven days of first observed session | 123 / 227 | 54.2% | Matured cohort, first recorded session is not necessarily first-ever use |
| Repeat exporters on different dates | 1 / 160 | 0.6% | Calendar-date diagnostic |
| Matured first exporters returning 24h–8d later | 1 / 120 | 0.8% | Joined retention proxy; UTC time interval |
| New paid checkout buyers | 1 | — | Stripe customer, excludes renewal-only buyers |
| New subscription checkout starts | 0 | — | Paid subscription-mode checkouts only; no unpaid trials |
| Paid renewal invoices | 3 | $15 cash received | Invoice paid_at within 30 days, not event count |
| Paid Pass checkouts | 1 | $4 gross | Checkout creation-date window; do not equate with exact payment-date cash ledger |
| Active subscriptions / MRR | 3 | $15 MRR | USD normalized recurring line items; excludes trials |
| Support burden | unavailable | unavailable | No joined ticket/time ledger retrieved |

Fresh Stripe report covers the configured account without product filtering; confirm account scope before company-wide consolidation. Gross cash figures are before refunds, fees and tax separation. MRR is a run-rate, not recognized revenue. Renewal event tracking showed two actors while Stripe showed three invoices: use invoices for billing counts, not plugin events. Do not infer distinct all-purchase buyers by adding new buyers to renewal counts.

## Measurement contract

| Metric | Weekly definition / source |
| --- | --- |
| Qualified visits | Proposed: distinct first-party web actors with a tutorial instruction interaction or product CTA, exclude bots/internal QA. Denominator: unique human page visitors. Report source and landing page. Until instrumented, do not substitute redirect event count. |
| First successful exports | First observed `export_completed`, dedup export_id, joined to first session within 7d. Report n/N and only matured entrants. |
| Checkout creation | Distinct actors with server-created Stripe session after upgrade within 7d / distinct upgrade actors with full 7d observation. |
| Checkout completion | Distinct paid Stripe session IDs / created session IDs in the same cohort, allowing 7d to mature. Keep actor-based conversion separately; session retries are not buyers. |
| Distinct buyers | Distinct Stripe customer IDs with paid transactions in week, split first-ever buyer, existing subscription renewal, repeat Pass buyer. Email dedupe only in restricted analysis; no identities in exported reports. |
| Repeat exporting | Distinct first exporters with a later valid export 24h–8d after first / first exporters observed through day 8. Also W2 and W4 cohorts once mature. |
| Subscription starts / renewals | First paid subscription invoice IDs versus paid `subscription_cycle` invoice IDs; dedupe invoice IDs, filter ProtoVid products/currency. Renewal rate = renewed eligible subscriptions / subscriptions due with finalized outcome after retry window. Pending stays pending. |
| One-time revenue | Paid Pass payment-intent/charge amount minus linked refunds, separate gross, tax, net receipts and fees. Never add to MRR. |
| Recurring revenue | Paid recurring invoice cash minus refunds; report separately from active normalized MRR and recognized revenue. Annual MRR = recurring amount / 12. Preserve legacy prices. |
| Support burden | Incoming written tickets, distinct customers, billing/export categories, minutes spent, reopened tickets; tickets per 100 exporters and per buyer, with counts. Do not invent zero for no access. |

`weekly-cohorts.sql` is read-only and executed successfully; aggregate results are in evidence/joined-cohorts.json. Weekly rows at the window boundaries are partial; use fixed complete week boundaries for the regular scorecard. Existing identity mapping chooses the latest anonymous ID for an email. It can merge devices/shared emails and leaves anonymous cross-device behavior unjoined. Payment session IDs are preferable for checkout completion; the executed query is actor/time-based and explicitly labeled that way.

## Source links and attribution boundaries

Use utm_source, utm_medium, utm_campaign=organic_examples_202609 and utm_content per asset. Copy exact links from publication-copy.md and walkthrough-scripts.md. First-party tutorial CTAs use source=guide_client_delivery, guide_saas_walkthrough, guide_portfolio_case_study; the local allowlist fix also recognizes first_export_guide. Redirects remain available if analytics fails.

Current implementation records the allowed redirect source as `viral_growth_action` / `figma_install_clicked`. That means an outbound click, not installation or activation. It has no stable web visitor ID on these guides, and UTM persistence has not been implemented. UTM links are prepared identifiers, not proof that source data is already captured.

Proposed next instrumentation, only if the weekly review needs it: retain first-touch and last-touch UTMs in a first-party web identifier, attach to website checkout metadata, and persist that identifier through paid webhook events. Keep bot/test exclusion and identifier expiry documented. The Figma Community → installed plugin boundary does not carry that web ID: report that portion as unattributed. Do not fingerprint, infer identity from IP, or join a reviewer to the creator who sent the link. Optional “How did you find this?” attribution is self-reported and separate from deterministic joins.

Read-only inputs for weekly review: stats API, cohort SQL, paginated Stripe sessions/invoices/subscriptions, and written-support counts. The revenue summary API returned HTTP 500 on September 7; direct Stripe reads supplied this report. Diagnose that endpoint separately without expanding the marketing task into a refactor.

# Moral Tree Media Founder/Admin Analytics — Phase 2

Branch: `admin-analytics-v2`. Extends [Phase 1](./ADMIN_ANALYTICS_V1.md) with a durable financial data foundation. No deployment, merge, production database operation, or Stripe configuration change is part of this work. Every Phase 1 metric definition, the authorization boundary, and the API/page security headers are unchanged.

## Summary

| Capability                                     | Status                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Idempotent payment/refund/dispute ledger       | Implemented (webhook-written, from coverage start)                                 |
| Revenue today / week / month / lifetime        | Available **per currency**, with explicit complete/partial coverage                |
| Monthly vs annual revenue                      | Available where the invoice maps to exactly one configured plan; else unattributed |
| Successful payment counts (ledger, amount > 0) | Available per currency and window                                                  |
| MRR                                            | Available per currency; **partial/unavailable** until contract snapshots exist     |
| Subscription status history                    | Implemented (baseline + append-only transitions)                                   |
| Paid subscriber churn                          | Implemented; **unavailable until the first complete covered UTC month**            |
| New / returning paid subscribers, cancels      | Available from durable billing events                                              |
| Scheduled cancellations per window             | From history; marked incomplete for windows before history coverage                |
| Matured trial conversion                       | Available (added alongside, not replacing, the Phase 1 rate)                       |
| Consolidated multi-currency total              | **Unavailable by design**: no authoritative FX source                              |
| Geography, webhook delivery failures           | Still unavailable (no authoritative source; unchanged from Phase 1)                |

## Architecture

```
Stripe (TEST) ──signed webhook──▶ /api/subscriptions/webhook (unchanged boundary)
   processSubscriptionEvent — one transaction per event, account row lock
     ├─ receipt (mtm_webhook_events)            Phase 1, unchanged
     ├─ syncSubscription ─▶ mtm_subscriptions   + contract snapshot columns
     │                    └▶ mtm_subscription_history (only when state changed)
     ├─ recordLedger ─────▶ mtm_ledger_entries | mtm_ledger_gaps
     └─ recordEvent ──────▶ mtm_billing_events  Phase 1, unchanged
/admin, /api/admin/overview — authorizeAdmin (unchanged) → readOverview
     Phase 1 queries + readFinance (same REPEATABLE READ READ ONLY snapshot, 5s timeout)
```

- `lib/subscriptions/ledger.ts`: pure extraction (`invoicePaymentEntry`, `refundEntry`, `disputeEntry`, `invoicePlan`, `classifyTransition`) and the idempotent `writeLedger`.
- `lib/subscriptions/webhook.ts`: retrieves the **current** provider object inside the account lock (the existing "arrival order does not become state order" rule): `invoices.retrieve(id, {expand:["payments"]})` on `invoice.paid`/`invoice.payment_succeeded`; `charges.retrieve` + `refunds.list({charge})` on `charge.refunded` (and `charge.refund.updated` if an operator ever subscribes to it); `disputes.retrieve` on `charge.dispute.*`.
- `lib/admin/finance.ts`: pure reporting rules (Stripe minor units, currency formatting, coverage, MRR status, churn month, rates). Safe to import in the dashboard.
- `lib/admin/financeQueries.ts`: auditable aggregate SQL. Never selects email, registration JSON, provider IDs or payloads.
- `lib/admin/financeSnapshot.ts`: typed `Finance` model; returns `null` if migration 002 is absent, so the Phase 1 console keeps working.
- `app/admin/FinanceSections.tsx`: revenue, MRR, plan, subscriber-movement and churn presentation. The Phase 1 markup is retained verbatim as the fallback when `finance` is `null`.

## Schema additions (`apps/web/migrations/002_analytics_ledger.sql`)

The migration is transactional and repeatable. Re-running it never duplicates the baseline or moves a coverage start. It never runs at startup or build time. Apply it only to an explicit test database target, after `001`.

- `mtm_analytics_coverage(dataset, coverage_start, method, note)`: one row each for `payment_ledger`, `subscription_contracts` and `subscription_history`, set to the migration instant, with `method='webhook'`. `method='backfill'` is reserved for a future validated backfill.
- `mtm_ledger_entries`: one row per provider object. The `entry_key` is `stripe:invoice:<id>`, `stripe:refund:<id>` or `stripe:dispute:<id>`, so duplicate or concurrent delivery (including both `invoice.paid` and `invoice.payment_succeeded` for one invoice) records once. Columns:
  - Identity: `kind`, `user_id`, provider customer/subscription/invoice/payment-intent/charge/object references.
  - Money: `amount_minor` (bigint, ≥ 0) and `currency` (lowercase ISO, checked by the database).
  - Classification: `status`, `plan` and `price_id`.
  - Provenance: `livemode`, `provider_occurred_at` with `occurred_at_source` (`paid_at`, `object_created` or `event_created`), `source` (`webhook`/`backfill`), `source_event_id`, `recorded_at` and `updated_at`.
  - Payment rows are immutable once written. For refunds and disputes, only `status` can progress (for example pending → succeeded, or needs_response → lost). Refund and dispute rows inherit subscription, invoice and plan from the recorded payment with the same payment intent.
- `mtm_ledger_gaps`: provider objects that could not be recorded completely. Examples: missing or invalid amount or currency, a non-TEST object, customer mismatch, unpaid status, a payment made outside Stripe, an unverifiable refund charge, or more than 100 refunds on one charge. **Gaps never block entitlement processing** and are never guessed.
- `mtm_subscriptions` gains contract snapshot columns: `price_id`, `unit_amount_minor`, `currency`, `billing_interval`, `interval_count`, `quantity`, `discounted` and `contract_recorded_at`. They are refreshed from the retrieved subscription on every sync. Tiered, metered or unusual pricing stores no amount.
- `mtm_subscription_history`: append-only. The migration writes one `baseline` row per existing subscription; after that, a `webhook` row is written only when status, plan, scheduled-cancellation flag or paid-through changes. Each row records `transitions` (`created`, `status_changed`, `canceled`, `reactivated`, `plan_changed`, `cancellation_scheduled`, `cancellation_unscheduled`, `paid_through_changed`) along with the before/after values. `UNIQUE(subscription_id, source_event_id)` makes redelivery a no-op.

No additional personal data is stored. The ledger holds opaque provider references already present on `mtm_accounts.customer_id` and `mtm_subscriptions`. No email, name, card, address or payload is copied.

## Metric definitions

All windows are UTC and inclusive of their start: today starts at 00:00, the week starts Monday at 00:00, and the month starts on the 1st. "Lifetime" means everything recorded. Every query is bounded by the snapshot instant on both provider time and local `recorded_at`, so a snapshot is repeatable.

| Metric                            | Exact definition                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gross revenue (window, currency)  | Σ `amount_minor` of `payment` rows whose `provider_occurred_at` (Stripe `status_transitions.paid_at`, falling back to event time and labelled as such) is in the window. It is the customer-paid invoice amount **including any tax, before Stripe fees**.                                                                                                                                                                 |
| Refunds                           | Σ refunds with status `succeeded`, by refund creation time. Pending refunds are counted but not subtracted. Failed and cancelled refunds are ignored.                                                                                                                                                                                                                                                                      |
| Lost disputes                     | Σ disputes whose current status is `lost`, by dispute creation time. Open disputes are counted, not subtracted. Dispute fees are excluded.                                                                                                                                                                                                                                                                                 |
| Net revenue                       | Gross − refunds − lost disputes, per currency. It is a cash-movement view: a refund of an earlier payment reduces the window in which the refund happened.                                                                                                                                                                                                                                                                 |
| Successful payments               | Count of `payment` rows with `amount_minor > 0` (zero-value trial invoices are recorded but not counted).                                                                                                                                                                                                                                                                                                                  |
| Revenue by plan                   | Gross payments with `plan` attributed at payment time. The plan is attributed only when every priced invoice line has one Price ID that maps to a configured plan; otherwise the payment is "unattributed" (for example, mixed proration lines).                                                                                                                                                                           |
| Coverage (per window)             | **Complete** only when every stored Phase 1 `PAYMENT_SUCCEEDED` receipt in the window has a ledger payment for its invoice and no unresolved gap exists in the window. Otherwise **partial**, listing its reasons separately: receipts that predate ledger coverage (expected until a backfill), receipts after coverage began without a ledger amount (an anomaly), and gaps.                                             |
| MRR (currency)                    | Covers subscriptions that meet the Phase 1 paying definition (status `active`, `paid_until` > now, account not blocked). Each one contributes Σ `unit_amount × quantity ÷ (interval_count × (12 if yearly else 1))`, rounded half-up to the minor unit at presentation. It is the list price, excludes tax, and is **not** consolidated across currencies. Scheduled cancellations are included and also shown separately. |
| MRR status                        | _available_ when every paying subscription has an undiscounted contract snapshot; _partial_ (a lower bound, showing “N of M”) when some do; _unavailable_ when none do. Discounted subscriptions are excluded, because the effective amount after a discount is not stored.                                                                                                                                                |
| New paid subscriptions            | `PAID_SUBSCRIPTION_CONFIRMED` events in the window (one per subscription, first positive paid invoice; receipt time).                                                                                                                                                                                                                                                                                                      |
| New paid subscribers (first ever) | Accounts whose earliest `PAID_SUBSCRIPTION_CONFIRMED` falls in the window.                                                                                                                                                                                                                                                                                                                                                 |
| Returning paid subscribers        | `PAID_SUBSCRIPTION_CONFIRMED` in the window for an account that already had an earlier one (a reactivation after a lapse, or a new subscription).                                                                                                                                                                                                                                                                          |
| Cancellations                     | `SUBSCRIPTION_CANCELLED` events (`customer.subscription.deleted`) in the window.                                                                                                                                                                                                                                                                                                                                           |
| Trial conversions                 | `TRIAL_CONVERTED` events in the window.                                                                                                                                                                                                                                                                                                                                                                                    |
| Cancellations scheduled           | History rows with `cancellation_scheduled` in the window. The count is marked incomplete (†) for any window that starts before history coverage.                                                                                                                                                                                                                                                                           |
| Matured trial conversion          | Of trials (Phase 1 “started” predicate) whose single platform deadline `trial_end` ≤ now, the share converted at any time (the Phase 1 converted predicate). This is a new metric; the Phase 1 all-trials rate is unchanged.                                                                                                                                                                                               |
| Paid subscriber churn (month)     | Account-level. Opening = accounts with ≥ 1 subscription whose latest history state at the month's opening instant is `active` with `paid_until` > opening. Churned = opening accounts with no such subscription at the closing instant. Rate = churned ÷ opening. It is computed only for the most recent complete UTC month whose start is ≥ history coverage start.                                                      |
| Sandbox indicator                 | Counts of ledger rows by `livemode`. Subscription v1 rejects live events, so all rows are Stripe TEST data, and the dashboard says so.                                                                                                                                                                                                                                                                                     |

Phase 1 metrics (registered accounts, active paid subscribers, active trial users, canceled subscribers, monthly/annual paid accounts, started/converted trials, trial-to-paid conversion, status buckets, `PAYMENT_SUCCEEDED` receipt counts, recent activity, database/Stripe-configuration/webhook/duplicate-protection health, failed payment events) use exactly the same SQL (`lib/admin/queries.ts` is unmodified), and their regression tests pass unchanged.

**Proposed (not applied) definition note:** Phase 1 “successful payment event counts” include zero-value invoices (for example, trial invoices), because `invoice.paid` fires for them. The ledger count excludes them. Both are shown and both are labelled. Retiring the Phase 1 panel is a founder decision, not a technical one.

## Provenance and coverage

- Money comes only from provider objects retrieved with the pinned `2026-07-29.dahlia` client inside the account lock, after TEST-mode and customer-ownership checks. It is never derived from counts × advertised price, from Price configuration, or from unsigned input.
- The ledger, contract snapshots and history start at the moment migration 002 is applied. Nothing earlier is reconstructed. Existing subscriptions gain a contract snapshot on their next subscription webhook, so MRR is typically partial or unavailable until then.
- The Phase 1 `PAYMENT_SUCCEEDED` receipts are the reconciliation reference. They share the webhook-completeness assumption every metric already relies on: a payment whose webhook never arrived is invisible to both.
- Lifecycle counts use local receipt time. Ledger money uses provider occurrence time. The dashboard labels both.
- Geography: still no authoritative country source. Nothing is inferred from email, currency or campaign.

## Security model

- The authorization boundary is unchanged: server-owned UUID grants in `ADMIN_ACCOUNT_ROLES`, the existing hashed, expiring member session, blocked-account denial, and grants re-checked on every request. Denied pages return 404 and the API returns 403. Failures return a generic 503 with no exception text; a Phase 2 query failure rolls back the snapshot (tested).
- The aggregate model contains currencies, integer amounts, counts, rates and ISO timestamps only. Tests and the end-to-end check verified that email addresses, account UUIDs, registration JSON, provider IDs (`cus_`, `in_`, `sub_`), keys and connection strings are absent from the API JSON and the rendered HTML.
- Webhook failures (including provider retrieval errors during ledger recording) roll back the receipt and all writes, then return 503 so Stripe retries. Unverifiable data becomes a gap instead of blocking entitlement.
- If `STRIPE_SECRET_KEY` is a **restricted** test key, it now also needs read access to Invoices (incl. invoice payments), Charges, Refunds and Disputes.

## Operational requirements

1. **Apply `002_analytics_ledger.sql` before deploying this webhook code** to any environment. The webhook writes the new tables and would otherwise return 503 (and Stripe would retry) for every subscription/invoice event. `node scripts/check-subscriptions.mjs` now reports `Analytics ledger migration (002): applied|MISSING`.
2. The coverage start is the migration instant. Record it in the release notes. Do not edit `mtm_analytics_coverage` by hand.
3. Optional: subscribe the endpoint to `charge.refund.updated` so refund status changes (pending → succeeded/failed) are recorded without waiting for another `charge.refunded`. It is supported but not required. Do not change live endpoints as part of this branch.
4. Churn requires history to exist at a month's opening instant. The first churn figure appears on the 1st of the second calendar month after the migration.

## Testing

Run everything through the guarded runner (dedicated loopback DB only, disposable schemas, retained-fixture SHA-256 check before/after, provider credentials stripped). The runner now also fingerprints the four Phase 2 table names if they ever appear in `public`.

```sh
MTM_TEST_DATABASE_URL=postgresql://stuart@127.0.0.1:55439/mtm_subscription_test \
  node apps/web/scripts/test-admin-analytics.mjs
```

New coverage (46 tests; total 271):

- `ledger.test.ts`: extraction of verified invoices; the event-time fallback; 11 malformed or unverifiable payload shapes failing closed; no guessing of ambiguous payment references; plan attribution (single, mixed, unknown, truncated, empty); refund/dispute validation; every transition class.
- `subscriptions/integration.test.ts` (real PostgreSQL):
  - one ledger row across `invoice.paid`, `invoice.payment_succeeded` and concurrent redelivery;
  - gaps for invalid currency, live-mode and cross-customer invoices, with entitlement still granted;
  - rollback and retry on invoice retrieval failure;
  - annual versus mixed plan attribution;
  - refund status progression and plan inheritance;
  - unverified refund charge recorded as a gap;
  - dispute status following the retrieved dispute;
  - contract snapshot capture, with history appended only for real transitions, including redelivery;
  - unnormalisable pricing stored without an amount.
- `finance.integration.test.ts` (real PostgreSQL):
  - a Phase 1 database without 002 still works;
  - honest empty state (never “£0”);
  - per-currency sums with inclusive UTC starts, snapshot-bounded provider and recorded times, zero-amount invoices, succeeded/pending/failed refunds, and lost/open disputes;
  - reconciliation into pre-coverage, anomaly and gap reasons, resolving once recorded;
  - plan split without mixing currencies;
  - MRR normalisation with blocked, cancelled, lapsed, past-due, discounted and missing-contract exclusions;
  - lifecycle windows and history-coverage flags;
  - account-level churn (renewal, lapse, cancellation, new, plan switch) and unavailability before coverage;
  - matured trial conversion;
  - migration repeatability and database CHECK constraints.
- `finance.test.ts`: minor units (JPY/KWD), exact-integer guards, coverage rules, MRR status, churn month boundaries including year rollover and a coverage start exactly on the 1st.
- `view.test.ts` / `access.test.ts`:
  - per-currency rendering with no cross-currency sum;
  - coverage and sandbox labels;
  - unavailable MRR, churn and matured conversion states;
  - partial MRR and available churn denominators;
  - a generic 503 plus ROLLBACK on a Phase 2 query failure.

## Recorded validation — 25 September 2026

- 271/271 web tests passed across 25 files (225 pre-existing, plus 46 new), with **no skipped tests**: all PostgreSQL integration suites ran against disposable schemas on the loopback test cluster (`127.0.0.1:55439/mtm_subscription_test`). The retained Stripe acceptance tables fingerprinted identically before and after.
- Workspace typecheck, lint and Prettier format check passed. A local Next.js production build passed.
- End-to-end run of the local production build on loopback (`next start -H 127.0.0.1 -p 3917`) against a disposable seeded schema:
  - A founder session got 200 from both `/admin` and `/api/admin/overview`, with `private, no-store`, `noindex, nofollow` and `no-referrer` headers.
  - Anonymous, forged, blocked and expired sessions were denied (404 page, 403 API).
  - Zero hits for email, account UUID, provider IDs, `sk_test` or the database name.
  - Figures matched the seed (GBP MRR 999 + 9999/12 → £18.32; the month window was partial because of a pre-ledger receipt).
- The Phase 1 local headless Chromium was used at 1920, 1440, 1194, 834 and 390 px: no horizontal overflow and no page errors. A 390 px overflow found during this check was fixed: grid tracks now use `minmax(0, …)` so wide tables scroll inside their wrapper.
- The temporary server was stopped and the disposable schema dropped. No leftover schemas were found.
- Not run: `check-subscriptions.mjs` (it calls the Stripe test API) and any Stripe Dashboard/CLI acceptance. No provider network calls were made.

## Intentionally unavailable

- **Consolidated multi-currency revenue or MRR**: no authoritative FX rates are stored.
- **Revenue before ledger coverage**: marked partial, never estimated. A validated backfill is required first (see below).
- **Historical MRR trend**: only the current contract snapshot exists. MRR history would need daily contract snapshots or a contract-change history.
- **Churn before the first complete covered month**, and cohort retention curves (they need several months of history).
- **Net of Stripe fees, and tax-exclusive revenue**: balance transactions and tax breakdowns are not stored.
- **Geography, webhook delivery failures/retries, listening/content, voucher/partner analytics**: no authoritative source (unchanged from Phase 1).

## Known limitations

- Churn depends on history rows written by webhooks. A renewal webhook that arrives after a month closes makes that account look churned for that month. The same paid-through rule governs entitlement.
- Blocked (disputed) accounts are excluded from MRR, as in Phase 1, but are not modelled in history. Churn is subscription-access churn only.
- `refunds.list` reads a single page of 100 refunds per charge. Anything more is recorded as a gap.
- A plan attributed at payment time uses the Price IDs configured at recording time. A later Price rotation does not rewrite history, but payments on a no-longer-configured Price are unattributed.
- The admin session still has no MFA or step-up authentication (Phase 1 note). Do not add money exports before addressing that.

## Backfill and reconciliation (future)

A validated backfill should:

1. Page `invoices.list({status:"paid"})` (TEST first) per MTM-tagged customer, using the existing `invoicePaymentEntry`/`writeLedger` with `source='backfill'` and `ON CONFLICT DO NOTHING`.
2. Reconcile every pre-coverage `PAYMENT_SUCCEEDED` receipt to an invoice, and report any mismatch in both directions.
3. Backfill refunds and disputes per charge.
4. Only if reconciliation is clean, set `payment_ledger.method='backfill'` with an earlier `coverage_start` in a reviewed migration.

It must run against an explicit, confirmed target with a dry-run report first. It was deliberately not executed here because it needs provider network access.

## Recommended next work

- Phase 2 remainder:
  - a dry-run backfill/reconciliation command;
  - a scheduled daily reconciliation job comparing the ledger with Stripe balance transactions (fees, net payouts);
  - persisted webhook delivery telemetry (attempts, failures), so “failed deliveries” can become a real metric;
  - subscribing to `charge.refund.updated` in TEST.
- Phase 3:
  - an authoritative country dimension (Stripe Tax/billing address with explicit consent/provenance);
  - daily MRR/contract snapshots for trends;
  - cohort retention tables once three or more months of history exist;
  - account drill-down behind step-up authentication and separate export permission;
  - campaign/partner revenue attribution joined through the stored registration campaign identity;
  - listening/content event ingestion.

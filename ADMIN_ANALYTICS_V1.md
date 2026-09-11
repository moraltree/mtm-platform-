# Moral Tree Media Founder/Admin Analytics — Phase 1

Branch: `admin-analytics-v1`. Private, read-only dashboard at `/admin`; protected aggregate endpoint at `/api/admin/overview`. No deployment or production changes are included.

## Authorization and activation

The console reuses the existing verified account and expiring HttpOnly member-session cookie. It does not create a second password system or grant privileges through account registration, email domains, Stripe metadata, URL parameters, cookies containing roles, or the public UI.

Activation requires all of the following server-side settings:

- `SUBSCRIPTIONS_ENABLED=true`, with the existing subscription database/session configuration.
- `ADMIN_ANALYTICS_ENABLED=true`.
- `ADMIN_ACCOUNT_ROLES`: a JSON object mapping existing verified account UUIDs to `"founder"` or `"admin"`. Both roles have read-only overview access in Phase 1.

Example shape (replace the example UUID, not a real grant):

```text
ADMIN_ACCOUNT_ROLES={"00000000-0000-4000-8000-000000000000":"founder"}
```

An absent, empty, malformed, oversized, or unsupported-role configuration denies access. Ordinary subscribers and blocked accounts are denied. Every page/API request checks the current session and current server-owned grant before reading analytics. Revoking a grant requires updating server configuration; deleting its database session or blocking the account takes effect on the next request. Session expiry is enforced by the existing session query. Founder activation is deliberately not preconfigured in the repository.

Sign in through the existing `/subscribe` email verification flow, then visit `/admin`. Account creation and real Founder role assignment remain operator-controlled. There is no public navigation link to the console. A hidden URL is not the security mechanism.

The page is dynamically rendered; data is never prerendered or shared-cached. All private page/API responses carry no-store and noindex headers plus a no-referrer policy. Unauthorised pages render a private-access 404; the API returns 403. Session/database failures produce a generic unavailable response (API 503), without serializing exception messages. Server-only module guards prevent importing the data-access layer into a browser bundle. No PII, account UUIDs, raw registration JSON, provider payloads, keys, or connection strings are returned by the aggregate API.

The current member system uses email links and seven-day sessions; it does not provide MFA or a dedicated shorter admin-session policy. Consider step-up authentication before future sensitive write/export capabilities. This read-only console does not introduce those capabilities.

## Data and metric definitions

No migration, new persistent table, provider API call, or webhook behavior change is needed. Queries use existing PostgreSQL tables in one repeatable-read, read-only transaction with a five-second statement timeout per query. Recent activity is limited to 20 records. Dates are stored as timestamptz and all displayed windows are UTC; weeks start Monday at 00:00. Database receipt time is not Stripe occurrence or settlement time.

| Metric                          | Definition / source                                                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registered accounts             | All `mtm_accounts` rows, including administrators and blocked accounts.                                                                                                                                                                                   |
| Active paid subscribers         | Distinct unblocked accounts with at least one active subscription whose `paid_until` is in the future. Scheduled cancellation retains paid access.                                                                                                        |
| Active trial users              | Unblocked accounts with active, unexpired platform trials and no current paid access. Separate from Stripe `trialing`.                                                                                                                                    |
| Canceled subscribers            | Distinct accounts with any canceled subscription. Includes historical cancellations for accounts who rejoined.                                                                                                                                            |
| Monthly / annual paid accounts  | Distinct paid accounts per stored plan. Counts can overlap when one account has both plans.                                                                                                                                                               |
| Started trials                  | Accounts with a recorded `trial_start` and positive `trial_days`.                                                                                                                                                                                         |
| Converted trials                | Started trials marked converted or having a durable `TRIAL_CONVERTED` event. Direct paid purchases without a trial start do not count.                                                                                                                    |
| Trial-to-paid conversion        | Converted / started trials; unavailable for an empty denominator. Includes ongoing trials, so this is not a matured-cohort conversion metric.                                                                                                             |
| Subscription status             | Current subscription records in mutually exclusive buckets; scheduled active/trialing records are shown as canceling. Includes active, trialing, canceled, past due, unpaid, paused, incomplete, incomplete expired and other. Not unique account counts. |
| Successful payment event counts | `PAYMENT_SUCCEEDED` receipts for today, week, month and all time. Not currency totals or an invoice ledger.                                                                                                                                               |
| Recent activity                 | Latest 20 registration, successful payment, trial-conversion and cancellation records. Generic labels and UTC dates only.                                                                                                                                 |
| Database health                 | A successful read-only snapshot, or an unavailable screen.                                                                                                                                                                                                |
| Stripe integration              | TEST key/Price/webhook configuration presence and syntax only, never a claim of provider connectivity. Subscription v1 still rejects live billing keys.                                                                                                   |
| Webhook health                  | Last committed receipt timestamp and receipt count. Silence cannot establish healthy or broken delivery.                                                                                                                                                  |
| Duplicate protection            | Verifies receipt and billing-event primary key constraints in PostgreSQL. Not a duplicate-attempt counter.                                                                                                                                                |
| Failed payment events           | Recorded `PAYMENT_FAILED` receipts, separate from webhook delivery failures.                                                                                                                                                                              |

All counts reflect the connected database. Retained sandbox fixtures are not filtered or rebranded as real business performance. The dashboard displays a persistent partial-coverage/test-integration notice. It does not mutate expired trial states while reading.

## Intentionally unavailable

- Revenue today/week/month/lifetime: no invoice amount, currency or payment-time ledger is stored. A configured Price or payment count cannot reconstruct historical money.
- MRR: no reliable stored contractual amount, discount and currency basis for normalization of annual/monthly plans.
- Country breakdown: no trustworthy stored customer-country dimension. Never infer geography from email, currency or campaign names.
- Churn rate: no opening cohort/status history. Cancellation counts are not churn rates.
- Failed webhook deliveries / retry counts: failed transactions roll back, and attempts/errors are not persisted. Not shown as zero.
- Listening, content completion, device, voucher, partner and detailed campaign analytics: event sources are not yet present in this schema.

## Architecture and next phases

`lib/admin/policy.ts` owns grant validation and UTC window definitions. `auth.ts` is the server-owned session/role boundary. `queries.ts` contains auditable aggregate SQL. `overview.ts` provides one typed snapshot and a safe page/API service. The dashboard uses existing MTM cream/cappuccino tokens and has desktop, laptop and tablet layouts. Corporate header/footer/consent presentation is suppressed only within `/admin`; all existing public route behavior is retained.

New modules should reuse the same authorization boundary and return explicit availability/coverage. Suggested Phase 2: an idempotent invoice/payment ledger with currency and provider occurrence times, country-source provenance, durable delivery-attempt telemetry, and subscriber cohort history. Add reconciliation/backfill with a declared coverage start before revenue trends/MRR/churn. Then add account lookup/drill-down, campaign/partner dimensions, listening events and exports. Keep immutable source IDs and separate authorization for future write/export privileges. The pre-existing `adminOperations.ts` campaign-operation contract remains unchanged.

## Validation

Unit/access tests run with `npm run test --workspace=web -- src/lib/admin` (PostgreSQL tests skip unless configured).

Run all web and Stripe regression tests without deleting retained sandbox acceptance data:

```sh
MTM_TEST_DATABASE_URL=postgresql://stuart@127.0.0.1:55439/mtm_subscription_test \
  node apps/web/scripts/test-admin-analytics.mjs
```

The runner requires the dedicated loopback test database, creates a disposable search-path schema for existing destructive regression fixtures, uses separate disposable schemas for admin query tests, and verifies retained public acceptance tables have identical SHA-256 fingerprints before/after. It strips provider credentials from the child test environment. It never targets a production database.

Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run format:check`. Browser/render results and final validation counts are recorded in the implementation handoff. No merge, deployment, production restart, or Stripe/webhook setting change is part of this task.

### Recorded validation — 11 September 2026

- All 225 web tests passed across 22 files, including the existing Stripe subscription regressions and 32 new admin tests. Real PostgreSQL aggregation tests passed; no integration tests were skipped in this run.
- Workspace typecheck and lint passed. Local Next.js production build passed with both admin routes dynamically rendered. Repository format check and diff whitespace check passed.
- Production-build browser checks passed at 1920×1080, 1440×900, 1194×834, 834×1194 and 390×844. Screenshots retained under `/tmp/mtm-admin-analytics/overview-*.png` (seeded test fixtures, not business performance). MacBook and iPad portrait renders were visually inspected.
- Browser tests verified anonymous/ordinary/expired/forged/malformed/blocked/signed-out denial, authenticated rendering, no-store/noindex/no-referrer headers, no horizontal overflow, details disclosure, refresh and sign-out. No JavaScript page errors. Expected 404 responses occurred for denied pages.
- Secret canaries were absent from rendered HTML; changed-file secret-pattern scan passed. No real provider credentials were used by the browser/test fixtures.
- Temporary browser app and all test schemas were removed. Before/after fingerprints of retained Stripe acceptance tables matched. Browser support libraries/fonts were extracted under `/tmp` only; no system packages were installed.
- No real admin grant was assigned. Runtime activation remains off until an operator supplies an existing verified account UUID in server configuration. No production access, merge, deployment, restart or legacy-webhook modification occurred.

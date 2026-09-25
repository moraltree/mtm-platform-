# Moral Tree Media Founder/Admin Analytics — Phase 4 (Intelligence Centre)

Branch: `admin-analytics-v4`, from Phase 3 commit `fd15a73`. This phase builds on the [Phase 3 console](./ADMIN_ANALYTICS_V3.md) and does not redesign it. The console is still read-only and uses the same server-side Founder/Admin gate. Nothing has been deployed, merged or pushed. No production database, environment variable, service, Stripe configuration or webhook endpoint was touched. No production tracking was enabled.

## Implemented vs future

| Implemented and measurable now                                                                                                                                     | Built, but waiting on production telemetry or a decision                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Subscriber intelligence for six periods, each compared with the equivalent previous period                                                                         | Listening and content analytics: schema, validation, recorder, queries and UI are ready; collection is **not** switched on |
| Registration and trial cohorts, with outcomes to date                                                                                                              | Trial activation (a first listen), and first-listen and repeat-listen funnel stages                                        |
| Revenue for today, week, month, year to date and lifetime, plus a selected period; new vs renewal; monthly vs annual; refunds; lost disputes; failed-payment value | Month-by-month retention curves (history coverage must mature first)                                                       |
| Funnel from registration through trial and paid to retained                                                                                                        | Campaign visits, QR scans, vouchers, and attribution by partner or landing source                                          |
| Campaign attribution by server-validated campaign ID, with small-group suppression and drill-down                                                                  | Devices                                                                                                                    |
| Geography from the self-declared registration country, labelled as such                                                                                            | Webhook delivery failures (still not persisted)                                                                            |
| Data coverage and quality view, plus a "What data can I trust?" summary on the Overview                                                                            | FX-consolidated revenue (no authoritative FX source)                                                                       |
| Aggregate-only CSV export with audit logging                                                                                                                       | Persistent audit table and step-up authentication for exports (awaiting approval)                                          |

## Architecture

- **One snapshot per request, scoped to the view.** `lib/admin/console.ts#readConsole(view, period)` opens one `REPEATABLE READ READ ONLY` transaction with a 5-second statement timeout (`overview.ts#withSnapshot`). It runs only the sections that view declares in `VIEW_SECTIONS`.
  - The Phase 1–3 views (Overview, Operations, Activity, Subscribers, Revenue) also read the Phase 1–3 model through `readOverviewIn`, unchanged.
  - The new views run only their own loaders (2–5 bounded aggregates).
  - `getConsole` authorizes the session and role first. The `view`, `period` and `campaign` parameters are allowlisted presentation choices. They are never used for authorization, and prototype keys such as `__proto__` are rejected.
- **Loaders:** `lib/admin/intel/load.ts`.
- **Auditable SQL:** `lib/admin/intel/queries.ts`. Every query is bounded by the snapshot instant on both provider time and local recording time.
- **Pure rules:** `lib/admin/intel/rules.ts` (attribution allowlist, suppression, coverage evaluation) and `lib/admin/intel/periods.ts`.
- **CSV:** `lib/admin/intel/csv.ts` and `exports.ts`.
- **Multi-window queries** pass the windows as arrays (`unnest`), so one query covers today, week, month, year to date, lifetime, the selected period and its comparison. The Revenue view therefore runs 4 aggregate queries plus MRR, not one per window.
- **Measured locally:** full-page server response (including rendering) had a median of 70–166 ms per view over 77 renders on synthetic data (about 60 accounts). This is not a production benchmark.
- **UI:** 11 views, grouped in the sidebar:
  - Business: Overview, Subscribers, Cohorts, Revenue
  - Growth: Funnel, Campaigns, Audience
  - Product: Listening
  - System: Operations, Activity, Data coverage

  A server-rendered period selector (plain links) appears on the Subscribers, Revenue, Funnel, Campaigns, Audience and Listening views. The Phase 3 `?view=roadmap` bookmark now opens Data coverage.

- **Drill-downs:**
  - Subscriber KPIs link to Cohorts, Revenue or Activity.
  - Plan mix links to plan revenue.
  - The Funnel links to Campaigns, and each campaign opens its own funnel (`?campaign=`, validated against displayed rows).
  - Content (world → season → story) is designed into the listening queries and awaits telemetry.

## Database changes: `apps/web/migrations/003_analytics_intelligence.sql`

Transactional and repeatable. Apply after 001 and 002, and only against an explicit test target. Apply it before deploying this webhook code.

- **`mtm_analytics_coverage`:** the CHECK constraint now allows `billing_reason`, `payment_failures` and `listening`. Coverage rows are inserted for the first two at migration time. **No `listening` row is inserted**; that happens only when approved telemetry goes live.
- **`mtm_ledger_entries.billing_reason`:** Stripe's invoice `billing_reason`, captured going forward. Earlier rows stay NULL ("unclassified") and are never guessed.
- **`mtm_payment_failures`:** one row per invoice with a failed attempt. It stores the amount due and currency, first and last failure time, and an attempt count. Recovery is worked out at read time from a later ledger payment for the same invoice.
- **`mtm_library.story_world` and `mtm_library.season`:** nullable. They are filled by the catalogue import and never inferred from titles.
- **`mtm_listening_events`:** see "Telemetry design" below. It is created empty.
- **Indexes:**
  - `mtm_billing_events(type, created_at)` and `(user_id, type, created_at)`
  - `mtm_accounts(created_at)`, and a partial index on `trial_start`
  - `mtm_webhook_events(processed_at)`
  - listening indexes on `occurred_at` and `(story_id, occurred_at)`

**Webhook changes (forward-only, TEST-only, same transaction as before):**

- `invoice.paid` and `invoice.payment_succeeded` ledger rows now record `billing_reason`, after validating its format.
- `invoice.payment_failed` retrieves the invoice inside the account lock and upserts `mtm_payment_failures`.
- A live-mode or cross-customer invoice becomes a ledger gap. It is never recorded as a failure.
- Receipt deduplication means a redelivered event never adds an attempt.

## Metric definitions

**Periods.** The current window runs from the start to the snapshot instant. The comparison window has the same elapsed length and ends where the next one begins.

| Period         | Current window                   | Compared with                                                              |
| -------------- | -------------------------------- | -------------------------------------------------------------------------- |
| Today          | From 00:00 UTC to now            | The same time yesterday: from yesterday's midnight to exactly 24 hours ago |
| 7, 30, 90 days | The last N days up to now        | The N days immediately before                                              |
| Month to date  | From the 1st of the month to now | The same elapsed time into the previous month, clamped to that month's end |
| All history    | Every stored record              | No comparison                                                              |

Revenue calendar windows are UTC, with weeks starting Monday and the year starting 1 January.

| Metric                                       | Definition                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New registrations                            | `mtm_accounts.created_at` in the window.                                                                                                                                                                                                                                                                                                                                          |
| Trial starts                                 | `trial_start` in the window, with a positive trial length.                                                                                                                                                                                                                                                                                                                        |
| Trial activations                            | **Awaiting telemetry** (a first listen during the trial). The stored `TRIAL_ACTIVE` marker is written at the same instant as the trial start, so it is not reported as activation.                                                                                                                                                                                                |
| Trial-to-paid conversions                    | `TRIAL_CONVERTED` events in the window.                                                                                                                                                                                                                                                                                                                                           |
| New paid subscriptions                       | `PAID_SUBSCRIPTION_CONFIRMED` events (the first positive paid invoice per subscription).                                                                                                                                                                                                                                                                                          |
| First-time paying subscribers                | Accounts whose first-ever paid confirmation falls in the window.                                                                                                                                                                                                                                                                                                                  |
| Reactivated subscribers                      | A paid confirmation after a cancellation that itself followed an earlier paid confirmation for the same account (paid → cancelled → paid). Out-of-order events never count as a comeback.                                                                                                                                                                                         |
| Completed cancellations                      | `SUBSCRIPTION_CANCELLED` events in the window.                                                                                                                                                                                                                                                                                                                                    |
| Scheduled cancellations                      | Now: distinct unblocked accounts with an active or trialing subscription set to cancel at period end. In the window: history rows with `cancellation_scheduled`, shown only when the window starts after history coverage began.                                                                                                                                                  |
| Failed payments                              | Each `PAYMENT_FAILED` event, including Stripe's retries.                                                                                                                                                                                                                                                                                                                          |
| Net subscription movement                    | New paid subscriptions − completed cancellations (both counted per subscription). Lapses without a cancellation are excluded; the history-based measure below captures them.                                                                                                                                                                                                      |
| Subscriber growth                            | Accounts with paid access at the window's start and at now, from `mtm_subscription_history`, with gained and lost accounts. **Only** measured when the window starts after history coverage began; otherwise shown as "not measurable".                                                                                                                                           |
| Active paid, monthly/annual, conversion rate | Phase 1 definitions, unchanged.                                                                                                                                                                                                                                                                                                                                                   |
| Registration cohorts                         | Accounts grouped by UTC month of registration, showing started trial, converted from trial (Phase 1 rule), ever paid, paying now, cancelled and reactivated. "Paid retention today" = paying now ÷ ever paid. This is current state, **not** a monthly curve. Latest 24 months.                                                                                                   |
| Trial cohorts                                | Accounts grouped by trial-start month, showing started, deadline passed, converted, and matured conversion (converted ÷ trials whose deadline has passed).                                                                                                                                                                                                                        |
| Revenue windows                              | Per currency: gross ledger payments; new (`subscription_create`); renewal (`subscription_cycle`); other; unclassified (captured before billing-reason recording began); monthly and annual plan; succeeded refunds; lost disputes; net. Provider occurrence time is used. Coverage uses the Phase 2 reconciliation, applied to any window.                                        |
| Failed-payment value                         | Invoices whose first failure falls in the window, valued at the amount due. Recovered = later paid in the ledger. Outstanding = failed − recovered. Only from failure-value coverage onward.                                                                                                                                                                                      |
| MRR                                          | The Phase 2 definition, unchanged. A current snapshot, not a trend.                                                                                                                                                                                                                                                                                                               |
| Funnel                                       | Accounts registered in the period, followed to today: registration → trial started → paid (any route) → retained (paying now). Campaign visit, first listen and repeat listen are shown as **Unavailable**, never as 0. Each stage states its source.                                                                                                                             |
| Campaign attribution                         | The server-validated `registration.campaignId` (the campaign route or fixed `/free30` identity, checked at registration). Keys must match `^[a-z0-9][a-z0-9_-]{0,63}$`; anything else counts as "no campaign". Campaigns with fewer than 5 registrations are grouped. Attributed revenue = net ledger payments to date from accounts registered under the campaign, per currency. |
| Geography                                    | The self-declared, optional registration country. Only codes on the site's country list (`lib/countries.ts`) are shown; others count as "unrecognised" and blanks as "not provided". Countries with fewer than 5 registrations are grouped. Region and city are not collected.                                                                                                    |

## Provenance and coverage

The Data coverage view evaluates 13 domains at request time. Each shows **Available**, **Partial** or **Unavailable**, with its source, a coverage date and the reason. The domains include accounts, lifecycle events, the revenue ledger, new vs renewal, failed value, MRR, history-based churn and growth, cohorts, campaigns, geography, listening, webhook failures and environment (test vs live money). The Overview summarises the same information. "Unavailable" is always explained and never shown as zero. Money is flagged as Stripe TEST sandbox data whenever the ledger holds no live entries.

## Privacy decisions

- **Aggregate only.** No view, API or export returns email addresses, names, account or provider IDs, registration JSON or payloads. Queries reduce registration JSON to the campaign ID or declared country only.
- **Small-group suppression** (k = 5) for campaign and country rows, in the console and in exports.
- **Unvalidated values are never reported.** Partner and landing-source values can come from editable form fields, so they are not reported. No location is inferred from email, currency, campaign names or IP addresses.
- **Exports** are aggregate CSV only, with the same authorization, `no-store`/`noindex`/`no-referrer`, `nosniff` and `attachment` headers. Cells that could run as spreadsheet formulas are neutralised. Each export writes one structured audit log line (`event`, `at`, `actor`, `role`, `report`, `period`). The actor is a salted, truncated hash of the account UUID, never the UUID or email. An unavailable report returns 409 rather than an empty file.

## Telemetry design (listening) — schema only

`lib/listening/events.ts` (the validator and `recordListeningEvents`) and the `mtm_listening_events` table are ready. **Nothing calls the recorder.**

**Events:**

- `story_started`
- `progress` (seconds listened since the previous event, 0–3600)
- `story_completed`
- `sleep_timer_set` and `sleep_timer_ended`

**Stored:**

- a random per-playback session UUID and a sequence number, which together make retries idempotent;
- the story ID, a coarse device class, and the time the event occurred;
- the listener's class (paid, trial or anonymous), derived **on the server** from the entitlement and never accepted from the client;
- the internal account UUID, used only for repeat-listen counts and never returned.

**Never stored:** IP address, user agent, precise location, email, names, fingerprints or free text. Unknown fields are rejected, and events more than 5 minutes in the future or older than 7 days are rejected.

**Queries built and tested with seeded data:**

- listening hours, sessions, average session length and completion rate;
- most listened, completed and replayed stories;
- Story World popularity (from `mtm_library.story_world`);
- listening by hour and by listener class;
- sleep-timer use.

**Activation (needs your approval):**

1. Privacy-notice and retention decision.
2. Wire the audio route or client beacon to the validator and recorder.
3. Insert the `listening` coverage row.

## Testing

**Automated tests: 386 passed across 34 files, none skipped.** They ran through the guarded runner (loopback `:55439/mtm_subscription_test`, disposable schemas, retained-fixture SHA-256 unchanged). The runner now also fingerprints `mtm_payment_failures` and `mtm_listening_events`. There are 84 new tests:

- **`intel/load.integration.test.ts`** (real PostgreSQL):
  - migration repeatability and constraints;
  - period counts and comparisons, including exact today and same-time-yesterday boundaries;
  - reactivation (including the out-of-order case) and net movement;
  - history-based growth inside and outside coverage;
  - scheduled cancellations;
  - revenue across calendar windows, per currency, including a year boundary, new/renewal/unclassified, plans, refunds (succeeded vs pending), lost disputes and failed/recovered/outstanding value;
  - cohorts;
  - campaign attribution, suppression, malformed keys and revenue;
  - countries (valid, lowercase, unrecognised, not provided);
  - listening awaiting → available with idempotent retries and replays;
  - coverage inventory;
  - no identifiers in any output.
- **`intel/rules.test.ts`:** periods (including the month-to-date clamp and Monday weeks), attribution allowlists, suppression, coverage evaluation, CSV escaping and formula neutralisation, minor-unit formatting, and the report allowlist.
- **`listening/events.test.ts`:** 17 rejection cases, including PII fields, client-supplied class, fingerprints, clock skew and bounds.
- **`api/admin/export/route.test.ts`:** 403/400/409/503, headers, the audit line and report-to-view mapping.
- **`console.test.ts`:** each view loads only its own sections, a missing migration is reported, and authorization runs first.
- **`intel.view.test.ts`:** grouped navigation with one current period; each view's content; unavailable stages shown as unavailable; per-currency revenue with no sums across currencies; the listening awaiting state shows no figures; the "not installed" states; no PII or unexpected properties; a single form (Sign out).
- **Subscription integration additions:** new-vs-renewal capture (including rejecting a malformed `billing_reason`) and failed-invoice value, attempts, redelivery and live-mode gaps.
- **Existing Phase 1–3 tests** were updated only where the UI evolved:
  - the footer now reads "Phase 4";
  - the Subscribers view no longer hosts the funnel or rolling-comparison table;
  - the future-areas list changed;
  - the view list grew.

**Defects found and fixed during validation:**

- The export report allowlist and the view alias map both accepted `__proto__` through the prototype chain (now own-property checks, with regression tests).
- The reactivation rule counted out-of-order events.
- Two fixture errors.
- Mobile overflow: the console's implicit grid column let the period tabs widen the page (fixed with a `minmax(0, 1fr)` column).

**Browser validation** used a local production build on loopback `:55444` against a disposable schema with synthetic data and fake secrets:

- **Renders:** all 11 views at 1920×1080, 1440×900, 1194×834, 1180×820, 834×1194, 820×1180 and 390×844 (77 renders). All returned 200 with correct headers, no horizontal overflow, no page errors and no leaks, with a single form on each page.
- **Periods:** every period on four views, with exactly one current tab.
- **Drill-down:** the campaign drill-down worked, and a malformed campaign parameter was ignored. `?view=roadmap` opened Data coverage and `__proto__` fell back to the Overview.
- **Denial:** anonymous, ordinary, expired, forged, malformed and blocked sessions were denied on pages and exports. Sign-out revoked access.
- **Exports:** five exports with correct headers and no leaks. Five audit lines were written, none containing an account ID, token or email.
- **Console errors:** only the 16 expected 404s from denial checks.
- **Files:** screenshots are in `/tmp/mtm-admin-analytics-v4/`, and the schema was dropped.

Typecheck, lint, Prettier and a production build pass.

## Future recommendations

1. **Approve and enable listening telemetry.** This unlocks the Listening view, trial activation, first- and repeat-listen funnel stages and content drill-down.
2. **Bind the partner to the validated campaign configuration** (not the form), then report partner attribution the same way as campaigns. Add a server-side QR scan log and a voucher ledger.
3. **Monthly retention curves** from `mtm_subscription_history` once a full month of coverage has passed.
4. **A persistent `mtm_admin_audit` table and step-up authentication** before any richer export. Decide investor-report formats. Both need approval, because they are writes.
5. **Record webhook processing failures** outside the rolled-back transaction.
6. **Backfill and reconciliation tooling** for pre-coverage ledger history (Phase 2 design).
7. **Performance:** at larger volumes, precompute daily aggregates (a read-model table refreshed by a scheduled job) rather than scanning the event tables. This isn't needed at current volumes.

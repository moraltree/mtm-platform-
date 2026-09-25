# Moral Tree Media Founder/Admin Analytics — Phase 3 (Founder Console)

Branch: `admin-analytics-v3` (from `admin-analytics-v2` at `7e0e810`). Phase 4 extends this console; see [ADMIN_ANALYTICS_V4.md](./ADMIN_ANALYTICS_V4.md). Builds the finished, read-only Founder Console on top of [Phase 1](./ADMIN_ANALYTICS_V1.md) and [Phase 2](./ADMIN_ANALYTICS_V2.md). There is no migration, no new write path, no provider call and no change to the authorization boundary. Nothing was deployed, merged or pushed.

## What was built

- **A multi-view console** at `/admin`. Views are selected with `?view=` from an allowlist; any other value renders the Overview:
  - Overview (the default)
  - Subscribers & conversion (`growth`)
  - Finance (`finance`)
  - Operations (`operations`)
  - Activity (`activity`)
  - Future analytics (`roadmap`)
- **Server-rendered views.** Each request authorizes first, then renders a single view from the same read-only snapshot. This keeps each screen short on an iPad instead of one long scroll.
- **A new read-only `insights` block** in the snapshot and API (`lib/admin/insights*.ts`), built from the same `REPEATABLE READ READ ONLY` transaction with its 5-second timeout. It contains:
  - 30-day daily series of durable events;
  - equal-window 7-day and 30-day comparisons;
  - a count of accounts that have ever paid;
  - webhook receipt recency;
  - unresolved ledger gaps;
  - per-currency daily gross revenue with day-level coverage;
  - a 25-item executive activity feed.
- **Charts** are server-rendered SVG with no chart library and no client script, so the existing CSP and static-first approach are unchanged.
  - Each chart is single-series in one validated data hue (`#9a5b22`, which passes the dataviz lightness, chroma and contrast checks on the card surface), so no legend is needed.
  - Bars have 4px rounded data ends, recessive hairline gridlines, per-bar hover titles and an accessible summary (`role="img"` with `aria-label`), plus a "Show data table" disclosure listing every value.
  - Today's bucket is drawn lighter and labelled "so far".
  - Days before ledger coverage are a shaded band and are never drawn as zero.
- **Components:**
  - KPI tiles and sparklines.
  - Tap- and keyboard-friendly definition popovers (`<details>`, no JavaScript), anchored to their card so they never leave the viewport.
  - Status pills that always pair an icon with words, never colour alone.
  - Signed deltas, labelled with the comparison period and whether up is good.
  - Share bars for the funnel, plan split and status breakdown.
- **Visual identity:** cream, cappuccino and chocolate from the site tokens, plus an admin-scoped olive accent (`#4f5d23`). Type sizes were increased for iPad legibility (15px body, 13px minimum detail), and navigation and buttons have 44px touch targets. Every text/background pair used measures at least 5:1 (WCAG AA).

## UI structure

| View                     | Contents                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overview                 | Four KPI tiles: paid subscribers as the hero figure, with new paid subscriptions over 30 days and their delta; active trials with a sparkline; trial-to-paid conversion; registrations with a 7-day delta. Plans & movement: monthly vs annual accounts, plus cancellations, payments and failed attempts over 30 days, each with deltas. Revenue this month and MRR, with coverage. System health pills. Latest six activity items. |
| Subscribers & conversion | Registration → trial → paid funnel (shares of registered accounts). 7-day and 30-day period comparison table for seven measures. Daily trends for registrations, trial starts, new paid subscriptions and cancellations. Started trials, trial-to-paid conversion, matured trial conversion and paid churn. Subscriber-movement table (Phase 2). Subscription status share bars.                                                     |
| Finance                  | Coverage lede and sandbox notice. Revenue today, this week, this month and lifetime, per currency, with coverage pills and reasons. Plan strip with MRR. Daily gross revenue, one chart per currency. Revenue by plan. Payment status: successful and failed payments with deltas, plus the Phase 1 payment-receipt counts.                                                                                                          |
| Operations               | Database, Stripe TEST configuration, duplicate protection, last webhook (with 24-hour and 7-day receipt counts), failed webhook deliveries (unavailable) and failed payment events. Ledger and reconciliation: coverage starts, open gaps, per-window coverage with reasons, and test/live entry counts. Metric definitions.                                                                                                         |
| Activity                 | The latest 25 records. Generic labels and UTC times only; attention items (failed payments, cancellations, refunds, disputes) are marked with a distinct dot as well as their words.                                                                                                                                                                                                                                                 |
| Future analytics         | Seven inactive areas, each stating what exists today and what is required to activate it.                                                                                                                                                                                                                                                                                                                                            |

Layout breakpoints:

| Width (target device)                    | Layout                                                               |
| ---------------------------------------- | -------------------------------------------------------------------- |
| ≥ 1500 px                                | Sticky sidebar                                                       |
| ≤ 1280 px (iPad landscape, 1180–1194 px) | 212 px sidebar; four KPIs remain side by side                        |
| ≤ 1100 px                                | Two KPI columns; paired panels stack                                 |
| ≤ 900 px (iPad portrait, 820–834 px)     | Sidebar becomes a top bar with a single row of navigation pills      |
| ≤ 700 px                                 | Charts go to a single column                                         |
| ≤ 540 px (phone)                         | Everything is single-column; the navigation row scrolls horizontally |

## New metric definitions

Phase 1 and Phase 2 definitions are unchanged; their SQL is untouched.

| Metric                         | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily series                   | Counts per **UTC calendar date** for the 30 days ending today, zero-filled, with today marked partial. The sources are: registrations (`mtm_accounts.created_at`); trial starts (`trial_start`, positive trial length); new paid subscriptions (`PAID_SUBSCRIPTION_CONFIRMED`); trial conversions (`TRIAL_CONVERTED`); cancellations (`SUBSCRIPTION_CANCELLED`); successful payments (`PAYMENT_SUCCEEDED`); and failed payment attempts (`PAYMENT_FAILED`). Billing events use database receipt time. |
| Period comparison              | Rolling windows of equal length, measured in instants: `(now−7d, now]` against `(now−14d, now−7d]`, and likewise for 30 days. A partial calendar day therefore never skews a comparison. The change is shown as a percentage only when the previous window is non-zero; otherwise it reads “Up/Down from N”. Rises in cancellations and failed attempts are shown as bad news.                                                                                                                        |
| Funnel                         | All-time. The stages are registered accounts; started a trial (Phase 1); converted from trial (Phase 1); ever paid (distinct accounts with a `PAID_SUBSCRIPTION_CONFIRMED`, including direct purchases); and paying now (Phase 1 active paid). Each stage is shown as a share of registered accounts. The stages are not strictly nested, and the console says so.                                                                                                                                    |
| Webhook recency                | Committed receipts in the last 24 hours and 7 days. Silence proves neither a fault nor healthy delivery.                                                                                                                                                                                                                                                                                                                                                                                              |
| Open ledger gaps               | Rows in `mtm_ledger_gaps` whose provider object was never subsequently recorded.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Daily gross revenue (currency) | The sum of ledger `payment` amounts per provider-occurrence UTC date, for one currency. Days entirely before ledger coverage are marked uncovered (shaded, “Not covered” in the table); the coverage-start day is partial. Net figures stay in the window cards, where refunds and disputes are defined.                                                                                                                                                                                              |
| Activity feed                  | The latest 25 of: registrations, trial starts, trial conversions, new paid subscriptions, successful and failed payments, cancellations, refunds and disputes. Only a generic kind and a UTC instant are returned.                                                                                                                                                                                                                                                                                    |

## Data coverage and unavailable metrics

- Event trends are complete from the earliest stored account (shown as “records since …”). They depend on the same webhook-completeness assumption as every Phase 1 metric.
- Revenue remains per currency and is labelled with its Phase 2 coverage. There is no consolidated multi-currency figure (no authoritative FX rate) and no historical MRR trend (current contract snapshot only). Churn stays unavailable until the first complete covered month.
- A daily **active-subscriber trend is intentionally not shown.** The current-state projection cannot reconstruct past days. Subscription history (Phase 2) could support one for days after its coverage start; that is recommended Phase 4 work.
- Failed webhook deliveries are still not persisted, so they are shown as unavailable, never as zero.
- **Future analytics** areas are static, inactive cards with no computed values:
  - **Listening behaviour:** no playback events are stored.
  - **Story and content performance:** the catalogue exists, but per-story engagement does not.
  - **Campaign attribution:** campaign and source IDs are captured at registration and copied to billing events, but no attribution model exists yet.
  - **Partner attribution:** an optional partner ID is present in the registration record but is not reported.
  - **Vouchers and QR campaigns:** nothing is issued or redeemed, and scans are not persisted.
  - **Geography:** there is no authoritative source; the optional registration country is self-declared.
  - **Devices:** nothing is stored.

## Security model

- **Unchanged boundary.** Every page and API request calls `authorizeAdmin()`: server-owned UUID grants, the existing hashed and expiring member session, and denial for blocked accounts, all before any query. The view parameter is read only **after** authorization and only selects presentation; tests cover denied users with `?view=finance`, `?view=../../api` and similar values.
- **Responses.** Denied pages return 404 and the API returns 403. Failures return a generic 503. All responses carry `private, no-store`, `noindex, nofollow` and `no-referrer`.
- **No PII.** The `insights` block contains only metric names, UTC dates and instants, counts, integer minor-unit amounts, currency codes and coverage states. Tests and browser checks confirm that email addresses, account UUIDs, registration JSON, provider IDs (`cus_`, `in_`, `pi_`, `sub_`), session tokens, the database URL and canary secrets are absent from the API JSON and from every rendered view.
- **Read-only.** The only form on the page is Sign out; a test asserts this. There are no write, delete, refund, export or customer-management actions.
- **No new client script.** Charts, popovers and tables are HTML/SVG with native `<details>`.

## Testing

- **Automated tests: 302 passed across 28 files, none skipped.** These run through the guarded runner (dedicated loopback `127.0.0.1:55439/mtm_subscription_test`, disposable schemas, retained-fixture SHA-256 check). There are 31 new tests:
  - `insights.test.ts`: UTC day filling across month/year ends, fair comparisons, day coverage, shares, clean axis maxima, direction semantics, and the view allowlist (including arrays, case and injection strings).
  - `insights.integration.test.ts` (real PostgreSQL):
    - honest empty state;
    - UTC bucketing and snapshot bounds;
    - exact rolling-window boundaries;
    - distinct ever-paid accounts and webhook recency;
    - per-currency revenue series with none/partial/full coverage and no currency merging;
    - feed kinds, ordering, the 25-item bound and absence of identifiers;
    - Phase 1 databases without the ledger.
  - `console.test.ts`:
    - all six views: exactly one current nav item, read-only chrome, a single form, no nested `<main>`;
    - Overview KPIs, deltas and popovers;
    - funnel shares and comparison wording;
    - uncovered revenue days shown as “Not covered”;
    - Operations evidence wording;
    - seven inactive future areas with no percentages;
    - no leakage of unexpected or private properties in any view;
    - BarTrend accessible summary and data table.
  - `access.test.ts`: page-level authorization before any view parameter (4 cases).
  - Existing Phase 1 and 2 view tests now render the view that hosts each assertion. Their assertions are unchanged except the footer label (“Phase 2” → “Phase 3”).
- **Defects found and fixed during validation:**
  - A PostgreSQL parameter-typing error in the comparison query (`$1 - interval`) would have made the live console return 503. The integration tests caught it.
  - Browser checks caught four layout defects, all fixed: an iPad-landscape overflow in Future-analytics card headers, a popover opening off-screen, info icons wrapping under titles, and seams in the uncovered-day band.
- **Browser validation** (local production build on `127.0.0.1:55443`, synthetic data in a disposable schema on the test cluster, canary secrets, the headless Chromium already installed under `/tmp`):
  - All six views at seven viewports (1920×1080, 1440×900, 1194×834, 1180×820, 834×1194, 820×1180, 390×844): 42 renders, all 200, correct headers, no horizontal overflow, no page errors, no leaks.
  - Anonymous, ordinary, expired, forged and malformed sessions were denied on the page (404) and the API (403), including with `?view=finance`. A blocked account was denied mid-session. Sign-out revoked access.
  - The only console errors were the 11 expected 404 resource loads from those denial checks.
  - The popover stayed inside the viewport on iPad and at 390 px. The data table disclosure opened. An unknown view fell back to the Overview.
  - Screenshots are in `/tmp/mtm-admin-analytics-v3/`. The disposable schema and server were removed afterwards.
- Workspace typecheck, lint, Prettier and a local production build all pass. `/admin` and `/api/admin/overview` remain dynamic.

## Recommended Phase 4

1. **Active-subscriber and MRR trends from history.** Daily states derived from `mtm_subscription_history` for days after its coverage start, with pre-coverage days shaded, as the revenue chart does.
2. **Campaign attribution.** Agree first- vs latest-touch and a conversion window, then aggregate the campaign/source IDs already stored on billing events. Suppress small groups (for example n < 5) to avoid identifying individuals.
3. **Webhook delivery telemetry.** Persist failed processing attempts outside the rolled-back transaction, with event type and a coarse error class only, so failed deliveries can become a real metric.
4. **Backfill and reconciliation tooling** (Phase 2 design): a dry-run first, run against TEST, before extending ledger coverage backwards.
5. **Step-up authentication** (MFA or a shorter admin session) before any drill-down, export or write capability. Separate the permission for each.
6. **Listening events** (privacy-reviewed) to activate listening behaviour and story performance.
7. **An optional date-range selector** (server-side, allowlisted ranges) once there is more than 30 days of meaningful data, plus a dark-mode theme validated with the same palette checks.

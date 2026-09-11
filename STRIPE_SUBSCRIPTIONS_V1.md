# Stripe Subscriptions v1 — test integration

This feature branch adds content subscriptions. It does not deploy anything,
change the production backend, or restore the dormant merchandise checkout.
The default `SUBSCRIPTIONS_ENABLED=false` preserves the existing website and
email-follow-up registration. No live Stripe keys are accepted by either the
new subscription integration or the existing Stripe client.

## Architecture audit

- `apps/web` is Next.js 16.3 App Router (patched from 16.3.0 to 16.3.4 during security review), React 19, Stripe SDK 22.5.0;
  Sanity owns editorial campaigns, products and legacy orders.
- `backend/index.js` is an Express health endpoint, associated with a live
  systemd service in the original worktree. It is unchanged; there is no
  cutover or migration of that service in this branch.
- Existing registration validates adult/guardian/legal consent, captures
  first/latest campaign attribution and offers, and emails a human. There
  were no accounts, authentication sessions, provisioned trials, subscription
  records, audiobook delivery service, or implemented voucher issuance.
- The old Subscribe page is a proposition/waitlist. The old Stripe webhook
  writes legacy Sanity orders and acknowledges handler errors. Content billing
  uses a separate verified endpoint and transaction store, avoiding changes
  to that dormant merchandise flow.
- Baseline: 143 tests passed. Workspace dependencies were not installed.
  No local web environment file or Stripe environment variables were present.

## Configuration and activation

Use a **dedicated test PostgreSQL database**, never the live backend database.
Apply `apps/web/migrations/001_subscriptions.sql` with a database migration
client against that explicit test target. No migration runs at application
startup or build time. The migration is transactional and repeatable.

Configure server environment values (never commit credentials):

| Variable                     | Purpose                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| `SUBSCRIPTIONS_ENABLED=true` | Explicit activation; default disabled                                  |
| `SUBSCRIPTIONS_DATABASE_URL` | Dedicated PostgreSQL test store; TLS required for remote DBs           |
| `STRIPE_SECRET_KEY`          | Stripe test secret/restricted key only                                 |
| `STRIPE_WEBHOOK_SECRET`      | Signing secret for the new subscription endpoint                       |
| `STRIPE_PRICE_MONTHLY`       | Active, positive, licensed recurring monthly test Price                |
| `STRIPE_PRICE_ANNUAL`        | Distinct active, positive, licensed recurring annual test Price        |
| `NEXT_PUBLIC_SITE_URL`       | Actual local/test origin, HTTPS except localhost                       |
| `RESEND_API_KEY`             | Existing transactional email provider, needed for verified sign-in     |
| `CONTACT_FORM_FROM_EMAIL`    | Verified sender for account emails                                     |
| `DEFAULT_TRIAL_DAYS=30`      | Non-campaign default, integer 0–30                                     |
| `TRIAL_CARD_REQUIRED=false`  | Require successful Stripe card setup before free access                |
| `TRIAL_AUTO_CONVERT=false`   | Explicit automatic conversion; implies card required                   |
| `LIBRARY_AUDIO_ORIGIN`       | Private HTTPS audio service origin                                     |
| `LIBRARY_AUDIO_TOKEN`        | Server-only bearer token required by the audio service                 |
| `ATTRIBUTION_COOKIE_SECRET`  | Existing signed attribution cookie configuration; strongly recommended |

No publishable Stripe key is needed. Browser requests contain internal plan
names, never authoritative Price/customer/user IDs. Changing prices requires
keeping configured IDs aligned with existing subscriptions; do not rotate IDs
without migrating existing subscriptions and reviewing webhook compatibility.

From `apps/web`, run `node scripts/check-subscriptions.mjs`. It loads local Next
environment conventions, prints variable presence only, checks test-mode
authentication when a key exists, validates Prices, and counts curated stories.
It never prints keys, database URLs, provider error bodies, or payment data.

## Stripe Dashboard / CLI setup

1. Create monthly and annual recurring Prices in Stripe **test mode**, then
   configure their IDs. The UI displays amounts retrieved from Stripe.
2. Configure the test Customer Portal. Allow cancellation, payment-method
   updates and invoice access. If enabling plan switching, allow only these
   two licensed Prices and quantity one; disable pause, arbitrary quantity,
   discounts and any trial extensions in portal configuration.
3. Deliver signed events to `/api/subscriptions/webhook`, **not** the dormant
   `/api/stripe/webhook`. With a local server on a deliberately chosen unused
   port, use `stripe listen --forward-to localhost:PORT/api/subscriptions/webhook`.
   Set the signing secret produced by that listener. Do not reuse a Dashboard
   endpoint secret for CLI-forwarded events.
4. Subscribe to `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`,
   `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`,
   `invoice.payment_action_required`, `customer.updated`, `customer.deleted`,
   `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`,
   and `charge.dispute.closed`.
5. Exercise test card success, declined card, authentication challenge,
   renewal, cancellation and duplicate event redelivery in the Dashboard.
   Outbound SDK/API requests are pinned to `2026-07-29.dahlia`. Prefer that
   schema for a separately configured Dashboard endpoint. CLI 1.50.11 uses the
   account-default event version (currently `2026-08-26.dahlia`) and offers only
   `--latest`, not an arbitrary event-version pin. Do not change the account
   default or an existing endpoint to run local acceptance.

   Signed TEST events from both `2026-07-29.dahlia` and `2026-08-26.dahlia`
   are supported: Stripe monthly versions within the same named release are
   [backward-compatible](https://docs.stripe.com/sdks/versioning). The outbound
   request pin does not select the schema of incoming webhook events. The
   handler preserves the signed payload, retains signature and TEST-mode
   validation, and retrieves current billing objects using the pinned client.
   Regression tests cover both event versions; a new named release requires
   separate compatibility review. No SDK upgrade or validation bypass is
   required for this local listener.

Reference: [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks),
[Stripe billing testing](https://docs.stripe.com/billing/testing),
[Stripe subscription trials](https://docs.stripe.com/billing/subscriptions/trials).

## Identity, registration and attribution

Registration still uses the existing adult consent validation and campaign
resolver. When enabled, it stores a short-lived email verification request
instead of emailing a human. No account or trial is granted before verification.
Sign-in links use 256-bit random single-use tokens, stored hashed with a
15-minute expiry. The email URL carries the token in its fragment so it does
not enter HTTP access logs; a confirmation POST consumes it. GET/link scanning
does not create a session. Sessions use hashed random tokens, expire in seven
days, and use HttpOnly/SameSite cookies and Secure on HTTPS.

Normalized email has a database uniqueness constraint. Returning registration
does not replace identity/consent/attribution or reset an existing trial. This
prevents straightforward repeat trials on the same verified account without
fingerprinting. Different email aliases/mailboxes are not treated as the same
person; a sophisticated abuse system is outside v1.

Campaign offers are re-resolved server-side; missing/inactive/mismatched
campaigns fail closed in enabled mode. `/free30` has a fixed server-owned
campaign identity and 30-day offer. Client trial days, offer fields, and Stripe
Price IDs cannot authorize a grant. Source/first/latest attribution is retained
for reporting, but does not independently authorize an entitlement or reward. Discount/offer metadata is preserved for attribution; this v1 does not apply campaign discounts to subscription invoices.

## One trial clock

The authoritative deadline is `mtm_accounts.trial_end`, calculated in UTC by
adding the approved number of calendar days to the start instant. Zero days
grants no free access. The maximum is 30 days, validated in application code,
campaign schema and database. Duration is frozen when the verification request
is created, so later configuration changes cannot silently extend it.

- Default: card-free, no automatic conversion. Starts after email verification.
- Card required: starts only after verified Stripe setup completion.
- Automatic conversion: implies a card; Stripe receives **that same absolute
  deadline** as `trial_end` to schedule billing. There is no second duration or
  separately restarted Stripe trial clock. The platform remains authoritative
  for curated access; changing Stripe trial dates does not extend free access.
- A parent can subscribe immediately. For an existing automatic-conversion
  trial, the application ends the Stripe trial and opens the resulting hosted
  invoice for payment/authentication. Confirmed payment immediately upgrades
  access to the full available catalogue.
- Trial cancellation stops free access. Paid access and trial access are
  separately derived; cancelling free access does not revoke a paid grant.
- Reads enforce deadline expiry even if maintenance has not run. Schedule
  `node scripts/expire-subscription-trials.mjs` daily in the test environment
  for complete expiration analytics and expired token/session cleanup. No
  scheduler or production service is installed by this branch.

## Library and entitlements

`mtm_library` is the private delivery catalogue adapter: stable audio ID, title,
published status and curated-selection flag. Import approved real stories from
the audiobook platform using its stable IDs. No title or audio was fabricated.
At least **30 published curated stories** are required before a nonzero trial
can start. Paid checkout requires at least one published story. The private
audio service must expose authenticated `GET /audio/:id`, enforce its bearer
token, and support Range requests. Its origin/token are never sent to browsers.
Do not use publicly readable Sanity asset URLs for protected audio.

`/library` shows the available selection. Every audio/Range request rechecks the
session, account, current entitlement and story eligibility, then streams the
private upstream response with no-store headers. There are no consumption
counters or one-listen restrictions. A stream already in progress can finish
after expiry; new requests are denied. Download/recording prevention is not DRM.

Paid access requires a positive paid invoice, active subscription status and a
future paid-through timestamp. Scheduled cancellation keeps access until the
paid period ends; immediate cancellation, unpaid/past-due/incomplete/paused
states remove paid access. An independently valid platform trial can continue.
Disputes block the account; closed/won disputes require reviewed reinstatement.
Refunds are recorded for downstream review and do not automatically cancel a
subscription (refund and cancellation are separate business operations).

## Reliability and reporting

PostgreSQL account row locks serialize Checkout and webhook processing. Checkout
operation IDs persist before network calls and become Stripe idempotency keys.
Retries reuse the session. An ambiguous operation older than 23 hours fails
closed for reconciliation rather than risking a second purchase after Stripe's
idempotency retention window. Support must inspect the test customer/session,
resolve any outstanding subscription, then remove only that account's stale
`mtm_checkout_attempts` row. No automatic destructive reset is provided.

Webhook signatures verify the raw body. Test mode is checked again on events
and fetched billing objects. Customer/user metadata is cross-checked against
stored ownership. Each event receipt, subscription projection and analytics
record commits in one transaction. Exceptions roll everything back and return
503 for Stripe retry. Concurrent duplicates do not repeat conversion events.
Current Stripe subscriptions are retrieved inside the account lock, so an old
webhook payload cannot overwrite a newer cancellation state.

`mtm_subscriptions` retains customer/user linkage, plan, status, periods,
cancellation and Stripe trial dates. `mtm_billing_events` records `TRIAL_OFFERED`,
`TRIAL_STARTED`, `TRIAL_ACTIVE`, `TRIAL_EXPIRED`, `TRIAL_CANCELLED`,
`TRIAL_CONVERTED`, `PAID_SUBSCRIPTION_CONFIRMED`, payment success/failure,
cancellation, refund/chargeback and other lifecycle hooks. Stable event keys
deduplicate trial and paid conversion transitions. This is the durable data
source for the next analytics project, not a dashboard or voucher issuer.
Trial start never issues a paid reward. Existing reward eligibility remains
metadata only; no voucher issuance implementation existed to preserve.

## Validation and remaining external work

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
`npm run format:check`. Real transaction tests additionally require
`MTM_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:55439/mtm_subscription_test`.
The integration suite refuses other database names/ports and resets only its
dedicated test tables. With no test database configured those integration tests
are explicitly skipped; policy/signature and existing web tests still run.

Remaining manual configuration: Stripe test credentials/Prices/webhook/Portal;
dedicated database and migration; verified email sender; private audio provider
and at least 30 real curated stories; explicit trial defaults; test scheduler.
Until these exist, no real provider-backed checkout, email or audio acceptance
test can be claimed. Founder review is required before a separate release task.

### Validation recorded in this worktree

- Baseline: 143 existing tests passed; final suite: **188 tests passed**,
  including real PostgreSQL transaction/concurrency tests and signed webhook
  verification. CI now runs the same suite with an isolated PostgreSQL service.
- Typecheck, lint, format check and Next.js 16.3.4 build passed. Builds were
  exercised with subscriptions enabled and disabled.
- Local HTTP checks passed for public pages, sign-in/verification pages,
  unauthenticated library redirect and API/audio denial, authenticated no-store
  entitlement responses, authenticated library and blocked-account audio denial.
- Web runtime dependency audit is clean after the compatible Next.js patch.
  The whole workspace still has 15 pre-existing dependency advisories (12 moderate,
  3 high) outside the clean web runtime audit; these require a separate dependency
  maintenance review. No secret patterns were found in changed/new files. Backend is unchanged and
  has no real test suite (its package script is only a failure placeholder).
- Stripe authentication **not run**: `STRIPE_SECRET_KEY` is absent. The webhook
  signing secret, both Prices, database configuration, email credentials/sender
  and private audio origin/token are also absent from the supplied environment.
  PostgreSQL test fixtures are isolated local test data, not configured content.
- No remote Stripe payment, Portal, email-delivery or real audio-provider test
  was possible without those credentials. The local test suite uses Stripe
  response fixtures; it does not substitute for the Dashboard acceptance run.

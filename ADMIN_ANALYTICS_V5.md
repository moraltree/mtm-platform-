# MTM Phase 5: production hardening and architecture reconciliation

Branch `admin-analytics-v5`, created from Phase 4 commit `eaa672e`. It is a
development phase. Nothing here has been deployed, migrated anywhere other
than disposable schemas on the loopback test cluster, or activated.

## Three separate states

These are three different states. Reaching one does not imply the next.

| State                    | Meaning                                                                                                                                                                                    | Status                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **CODE READY**           | The branch builds, all tests pass, migrations are ledgered and verified, and every Phase 4 blocker that code can fix is fixed.                                                             | **Yes, for a preview deployment**, once reviewed and committed.                  |
| **INFRASTRUCTURE READY** | Managed PostgreSQL with TLS, PITR and roles exists. One canonical Stripe TEST account is configured. Email, the audio origin and 30 real curated stories exist. Secrets have been rotated. | **No.** None of it exists yet; see "Remaining operator actions".                 |
| **PRODUCTION ACTIVATED** | Migrations have been applied to production and the code deployed to Vercel. `SUBSCRIPTIONS_ENABLED`, then the Founder Console, have been turned on deliberately after verification.        | **No.** Subscriptions, the console, exports and listening telemetry are all OFF. |

## Final architecture

```
Visitor ─ DNS (name.com records) ─ Vercel (moral-tree-media, Next.js 16)
   │
   ├─ Stripe (ONE TEST account; Checkout, Portal, signed webhooks → /api/subscriptions/webhook)
   ├─ Managed PostgreSQL — via the provider's TLS pooler (transaction mode)
   │     └─ direct endpoint used only by the operator's migration runner
   ├─ Sanity (editorial content and campaign configuration only, read path)
   ├─ Resend (verification email)
   └─ Private audio origin (bearer token; streamed through /api/subscriptions/audio)

mtm-prod-01: legacy Caddy/static site + backend/ health service only.
It hosts no production database and never needs a public PostgreSQL port.
```

| Domain                                                                  | Authoritative system                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Identity, email verification, sessions                                  | PostgreSQL (`mtm_accounts`, `mtm_login_tokens`, `mtm_sessions`)                                       |
| Trials and entitlement projection                                       | PostgreSQL (`mtm_accounts.trial_*`, `mtm_subscriptions`; read-time expiry)                            |
| Billing transactions, payment status, refunds/disputes, customer portal | **Stripe** (TEST mode)                                                                                |
| Billing-event ledger/history, analytics                                 | PostgreSQL (`mtm_billing_events`, `mtm_ledger_*`, `mtm_subscription_history`, `mtm_payment_failures`) |
| Export audit                                                            | PostgreSQL `mtm_admin_export_audit` (append-only)                                                     |
| Listening telemetry (future)                                            | PostgreSQL `mtm_listening_events`, **OFF**                                                            |
| Editorial content, Story Worlds, campaigns                              | Sanity (read); `mtm_library` for delivery IDs and curation                                            |
| Merchandise                                                             | Shopify (WP9); the WP7 Stripe shop stays dormant                                                      |

**Sanity is not a subscription, trial or entitlement authority anywhere in this branch.** The `/free30` journey test fails if Sanity's write client is touched at all.

## Reconciliation with production commit `6746516`

Production (Vercel `dpl_7CL1QQEv…`, `main`) runs six commits on top of `1dfed44` that implement a parallel, **Sanity-based** subscription design. Phase 5 does not cherry-pick them. Each element was compared semantically against the PostgreSQL architecture:

| `6746516` element                                                                             | Evidence of production behaviour                                                                                             | Phase 5 resolution                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerPlatformTrial` (Sanity `subscription` doc), `trialEligibility` (Sanity email lookup) | Vercel has no Sanity project/write token, so every `/free30` signup returns "We couldn't start your trial right now".        | Not ported. `/free30` uses `subscriptionRegistration`, then verified email, then `beginTrial` (PostgreSQL). With subscriptions disabled it uses the honest email stand-in, never Sanity.                                                                                                                             |
| `mtm_sub_ref` cookie (possession = identity, 400 days)                                        | —                                                                                                                            | Replaced by verified mailbox and hashed, expiring `mtm_member_session`.                                                                                                                                                                                                                                              |
| Sanity Studio `subscription` document type                                                    | No Sanity project exists, so no data was ever written.                                                                       | Not ported. Nothing to migrate.                                                                                                                                                                                                                                                                                      |
| `/subscribe` `SubscribeForm` and `createSubscriptionCheckout`                                 | Code reads `STRIPE_PRICE_MONTHLY/ANNUAL`; Vercel has `STRIPE_MONTHLY_PRICE_ID/ANNUAL_PRICE_ID`, so checkout was unreachable. | Phase 1–4 `/subscribe` plus `billing.checkout` (account-bound, idempotent). Canonical names kept; the misnamed variables now **fail closed** (see Stripe below).                                                                                                                                                     |
| `/subscription/success`, `/subscription/cancelled` pages                                      | Unreachable (checkout never offered), so no issued URLs exist.                                                               | Not ported; no redirects needed.                                                                                                                                                                                                                                                                                     |
| `/api/subscription/portal` (cookie → Sanity)                                                  | Inert without Sanity.                                                                                                        | `billing.portal`: verified account plus Stripe customer-metadata cross-check.                                                                                                                                                                                                                                        |
| Subscription handling inside `/api/stripe/webhook` (Sanity writes)                            | Inert without Sanity; route live on `STRIPE_WEBHOOK_SECRET`.                                                                 | Not ported. The dormant merchandise webhook now **ignores** `customer.subscription.*` and any object tagged `metadata.mtm=subscriptions-v1` or `checkoutType=subscription`, and uses its **own** `STRIPE_SHOP_WEBHOOK_SECRET` (unset = inert). `STRIPE_WEBHOOK_SECRET` belongs only to `/api/subscriptions/webhook`. |
| `starterCollection.ts` (Story-World-based trial content)                                      | —                                                                                                                            | Superseded by the per-story `mtm_library.free_selection` curation (at least 30 stories). A Story-World rule is expressed at catalogue import (003 added `story_world`). No second content-access authority.                                                                                                          |
| `trialConfig` (`TRIAL_DAYS_BY_CAMPAIGN` env JSON, max 30)                                     | —                                                                                                                            | Superseded by the server-resolved campaign offer (0–30, validated in code, schema and database). No second, environment-driven trial-length source.                                                                                                                                                                  |
| `stripe@22.6.1`, API `2026-08-26.dahlia`                                                      | —                                                                                                                            | Not ported. Phase 1–5 pins `22.5.0` / `2026-07-29.dahlia`, and signed events of **both** versions are accepted and tested. An SDK upgrade is a separate reviewed change.                                                                                                                                             |
| `subscriptionEntitlement` helpers                                                             | —                                                                                                                            | `policy.entitlement` (paid/trial/none, read-time expiry).                                                                                                                                                                                                                                                            |
| WP17 CLAUDE.md notes, Sanity-subscription tests                                               | —                                                                                                                            | Superseded by this document and the PostgreSQL integration tests.                                                                                                                                                                                                                                                    |

**Promotion consequence.** Merging this branch into `main` supersedes `6746516`'s subscription code. The merge (not done here) must take this branch's versions of the conflicting files and delete the Sanity-subscription files listed above. Legitimate Sanity editorial functionality is untouched.

## Phase 5 changes

- **TLS enforcement** (`src/lib/database/policy.mjs`, one implementation shared by the app, the migrator and the scripts):
  - Loopback may skip TLS, but is refused on Vercel.
  - Every other host must state `sslmode=verify-full`. Certificate and host name are then verified; an optional private CA is accepted as PEM text only.
  - Weaker modes, `host=`/`hostaddr=` redirection, file-reading parameters (`sslrootcert`, …) and `ssl=` overrides are rejected. node-postgres lets URL parameters override explicit options, so the URL is sanitised before use.
  - Errors never contain the URL.
- **Serverless pooling** (`db.ts`):
  - One pool per instance, bounded 1–10 (default 3 on Vercel), 5 s idle timeout, 300 s maximum connection lifetime, `allowExitOnIdle`.
  - A client-side 15 s query timeout (startup parameters would be rejected by transaction-mode poolers).
  - `application_name=mtm-web`; the idle-client error handler logs no details.
  - Verified under load: 20 concurrent queries never exceeded the bound, and no connections leaked.
- **Migration ledger and runner**: see below. 001–003 are now under it, 004 was added, and the misleading "TEST-only" headers were replaced by explicit environment statements.
- **Export security**: threshold 10, separate default-off switch, append-only audit, step-up boundary. See below.
- **Stripe normalisation**: a shared validator (`stripeConfig.mjs`) used by runtime and the check script. The check script verifies the key's account against `STRIPE_ACCOUNT_ID`.
- **Secret hardening**:
  - `safeLog.errorSummary` replaces raw error logging on Stripe paths. Stripe's signature error carries the full payload and header.
  - The email stand-in no longer logs visitors' email addresses.
  - Repository scanner (`scripts/scan-secrets.mjs`, also in CI) and canary-based leakage tests.
- **Telemetry kill switch**: the recorder refuses to write unless `LISTENING_TELEMETRY_ENABLED` is exactly `"true"`. No module imports it, and no ingestion route exists (both are tested).
- **Test process hygiene**: the guarded runner runs tests in their own process group, tags every child with a run ID, and kills and fails on any survivor. It fails on leftover `mtm_*` schemas and fingerprints every `public` table as well as the original list. A static test enforces loopback binding and managed spawns.
- **CI**: now also runs the admin/Phase 5 PostgreSQL suites (disposable schemas) and the secret scan.

## Migration architecture

```
node scripts/migrate.mjs status                                   # default, read-only session
node scripts/migrate.mjs apply --dry-run [--through NNN]          # read-only plan
node scripts/migrate.mjs apply --confirm-target DB@HOST [--through NNN]
node scripts/migrate.mjs baseline --through NNN --confirm-target DB@HOST
```

- **Target.** Only `MTM_MIGRATION_DATABASE_URL`: the provider's **direct**, non-pooled endpoint and the migration role. It is never the application URL, and never set in Vercel. The same TLS policy applies. Writes require `--confirm-target` to match the connected database and host exactly.
- **Ledger `mtm_schema_migrations`.**
  - Columns: version, name, SHA-256 checksum, method (`applied`/`baseline`), time, role, runner, duration.
  - Append-only: triggers reject UPDATE, DELETE and TRUNCATE.
- **Exactly once.**
  - A session advisory lock blocks concurrent runs.
  - Each migration runs in one transaction with `lock_timeout 5s`: guard setting, SQL, object verification, ledger row. It either commits entirely or rolls back entirely.
  - Nothing is ever automatically undone after commit; there are no down migrations.
- **Fail closed** on:
  - an applied version with no file
  - a changed checksum
  - a non-contiguous history
  - an empty ledger beside existing tables
  - an **unmanaged schema** (tables but no ledger)
  - a verification failure
  - a held lock
- **Guard.** Each file starts with a `DO` block that refuses to run unless the runner set `mtm.migration_runner`. Direct `psql -f`, which would not be atomic, is refused before anything is created. The files no longer contain `BEGIN`/`COMMIT`.
- **Pre-ledger databases.** `baseline --through NNN` verifies every version's objects against the live schema, then records `baseline` rows in the same transaction as the ledger's creation. A false baseline is refused and leaves nothing behind.
- **004 `mtm_admin_export_audit`.** Additive; append-only triggers; `REVOKE UPDATE, DELETE, TRUNCATE … FROM PUBLIC`; `min_group >= 10` enforced by the database.

| Migration | Lock profile                                                                                                      | Expected runtime (fresh database) |
| --------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 001       | Creates new tables only                                                                                           | < 1 s                             |
| 002       | ACCESS EXCLUSIVE on `mtm_subscriptions` (ADD COLUMN with CHECK)                                                   | < 1 s                             |
| 003       | Non-concurrent `CREATE INDEX` (SHARE locks on billing events, accounts, webhook events); coverage constraint swap | < 1 s                             |
| 004       | New table and triggers                                                                                            | < 1 s                             |

On a fresh production database all four run on empty tables, so the non-concurrent indexes are harmless. On a populated database, schedule them inside a quiet window: `lock_timeout` makes a blocked lock fail fast and roll back instead of queueing writers.

**Coverage clocks.** 002/003 record coverage starts at migration time. Apply them immediately before the deploy, with the Stripe endpoint not yet pointed at the new route, so the ledger cannot miss events inside its declared coverage.

## Security model

- **Admin gate.** `ADMIN_ANALYTICS_ENABLED` and `SUBSCRIPTIONS_ENABLED` must both be `"true"`, plus a valid UUID allowlist in `ADMIN_ACCOUNT_ROLES` and a live hashed session. Pages return 404 when denied; APIs return 403 without reading data.
- **Exports** additionally require `ADMIN_EXPORTS_ENABLED="true"`. Otherwise the route is a 404 and the links are not rendered.
- **Stripe.** Only `sk_test_`/`rk_test_` keys are accepted. `livemode` is rejected on events, customers, prices, invoices and sessions. The configuration is validated as a whole.
- **Secrets never emitted.**
  - Configuration errors name variables, never values.
  - Health/overview/export APIs return fixed messages.
  - Scripts print presence only.
  - Logs on Stripe paths carry only name/type/code/status.
  - Canary tests cover the database policy, the webhook route, both operator scripts and the redactor.
  - The guarded runner strips provider credentials from the test environment.
- **Filesystem permissions for credential-bearing files and backups** (recommended; not applied by this phase):
  - `.env.local`: mode `600`. The main worktree's is currently `664`.
  - Agent/shell snapshots (`~/.codex/shell_snapshots`): directory `700`, files `600`, or delete after use.
  - Backups:
    - `umask 077`, directory `700`, files `600`.
    - Encrypt (`age`/`gpg`) before storage.
    - Keep an encrypted copy off-host.
    - Exclude `.env*`, agent snapshots and `.git` credentials from archives.
    - Never keep an unencrypted archive containing `.env.local`.
    - The existing `~/backups/mtm-2026-09-12/mtm-platform-full.tar.gz` (mode `664`, unencrypted, contains `.env.local` and `.git`) should be re-created encrypted and the original securely removed **after** rotation. Not done here, as instructed.

## Export policy (approved decision 5, implemented)

| Rule                                                           | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internal console minimum 5                                     | `INTERNAL_MIN_GROUP = 5` (unchanged behaviour)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Export/external minimum 10                                     | `EXPORT_MIN_GROUP = 10`, re-applied at export time:<br>• counts 1–9 (and signed movements) become `<10`<br>• percentage changes between small groups are withheld<br>• revenue from fewer than 10 payments is `withheld (<10)`<br>• cohorts under 10 are fully masked<br>• campaigns under 10 are grouped, with **secondary suppression** (the smallest kept campaigns join the group until it reaches 10), so no campaign is recoverable by subtraction<br>• coverage `detail` text (which embeds raw counts) is omitted |
| Separate switch, default OFF                                   | `ADMIN_EXPORTS_ENABLED`; link hidden and route 404 unless enabled                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Append-only audit                                              | `mtm_admin_export_audit`:<br>• records request ID, actor account, role, report, sensitivity, allowlisted filters, min group, row/byte count, content SHA-256 and outcome<br>• outcomes: `released` / `unavailable` / `rate_limited` / `step_up_required`<br>• written **before** release; if the write fails, nothing is released (503)<br>• exported content is never stored                                                                                                                                             |
| Rate limit                                                     | 20 released exports per actor per rolling hour, counted from the audit table (holds across serverless instances)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Non-aggregate/sensitive exports require step-up authentication | Report registry classifies each report as `aggregate` or `sensitive`. `stepUpSatisfied("sensitive")` is always `false` (no step-up mechanism exists), so such a report is refused with 403 and audited. All five current reports are aggregate. **No PII export exists.**                                                                                                                                                                                                                                                 |

## Managed PostgreSQL: production specification

Required before INFRASTRUCTURE READY:

1. **Provider and region.**
   - A managed PostgreSQL 16+ service (e.g. Neon via the Vercel Marketplace, Supabase or AWS RDS) in the **same region as the Vercel functions**.
   - No database on mtm-prod-01 and no public port on that host.
2. **TLS.**
   - Certificates from a public CA, or a documented private CA given as PEM.
   - `sslmode=verify-full` on every URL; the application refuses anything weaker.
3. **Pooling.**
   - A provider pooler (PgBouncer transaction mode or equivalent) for `SUBSCRIPTIONS_DATABASE_URL`.
   - The direct endpoint is used only for `MTM_MIGRATION_DATABASE_URL`, which needs a session advisory lock.
   - Keep `SUBSCRIPTIONS_DATABASE_POOL_MAX` × expected concurrent instances within the pooler's client limit.
4. **Roles (least privilege).** Run as the provider admin after provisioning. `mtm_migrator` owns the schema; `mtm_app` has DML only:
   ```sql
   CREATE ROLE mtm_migrator LOGIN;   -- password set via the provider console
   CREATE ROLE mtm_app LOGIN;        -- password set via the provider console
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;
   GRANT USAGE, CREATE ON SCHEMA public TO mtm_migrator;
   GRANT USAGE ON SCHEMA public TO mtm_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE mtm_migrator IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mtm_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE mtm_migrator IN SCHEMA public
     GRANT USAGE ON SEQUENCES TO mtm_app;
   -- after the first migration run:
   REVOKE UPDATE, DELETE ON mtm_admin_export_audit, mtm_schema_migrations FROM mtm_app;
   REVOKE INSERT ON mtm_schema_migrations FROM mtm_app;
   ```
   The app never needs DDL, TRUNCATE or superuser.
5. **Backups and PITR.**
   - Automated daily backups plus continuous WAL/PITR, with at least 7 days of retention (14 recommended).
   - Backups are held by the provider, separate from the primary.
   - Plus a scheduled logical `pg_dump -Fc`, encrypted and off-provider, kept for 30 days.
6. **Restore testing.**
   - Before migration day, and monthly after that, restore (PITR branch or dump) into a scratch database.
   - Compare row counts with the source, and run `scripts/migrate.mjs status` against it.
   - Record the result. Never claim recoverability from the existence of a file.
7. **Isolation.**
   - A separate database or branch (and separate roles) for Preview and for local development.
   - Vercel Preview environment variables must never point at the production database.
   - The loopback test cluster (`127.0.0.1:55439`) is test-only.
8. **Monitoring.** Connection count against the pooler limit, storage, replication/PITR health, and slow queries.

**Provisioning procedure** (operator, when authorised):

1. Create the project in the chosen region.
2. Create the roles above.
3. Record the direct and pooled endpoints.
4. Enable PITR.
5. Run a restore test.
6. From the operator machine run `migrate.mjs status`. It should report all four migrations pending with no problems.
7. Only then proceed with the deployment sequence.

## Stripe TEST setup requirements (single documented configuration)

Two local TEST configurations were found pointing at different Stripe accounts:

- The main worktree's key is expired, and its Price IDs contain `…QcbIqtkyQF…`.
- The Phase 4 worktree uses `acct_1UET7hEFFFx3tee4` (country US, unnamed, charges disabled, both Prices inactive).

Neither is assumed canonical. The owner must confirm which account is Moral Tree Media's UK TEST environment. Then:

| Variable                                       | Value                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `STRIPE_ACCOUNT_ID`                            | The confirmed `acct_…`                                                                                                                                                                                                                                                                                                                                             |
| `STRIPE_SECRET_KEY`                            | A **restricted** test key from that account with write access to Customers, Checkout Sessions, Subscriptions, Billing Portal Sessions and Setup Intents; read access to Prices, Invoices, Charges, Refunds, Disputes and Balance. If the restricted key cannot read its own account, the check reports UNVERIFIED: confirm the account ID in the Dashboard instead |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` | Two **active**, licensed, recurring (month/year, interval count 1), same-currency test Prices in that account                                                                                                                                                                                                                                                      |
| `STRIPE_WEBHOOK_SECRET`                        | Signing secret of an endpoint at `https://<preview-or-production-origin>/api/subscriptions/webhook` subscribed to the 18 events in `STRIPE_SUBSCRIPTIONS_V1.md`, API version `2026-07-29.dahlia`                                                                                                                                                                   |
| Customer Portal                                | Cancellation, payment-method update and invoices allowed; plan switching limited to the two Prices, quantity 1; no pause, discounts or trial extensions                                                                                                                                                                                                            |
| Remove                                         | `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`, `STRIPE_TRIAL_PERIOD_DAYS`. If present, the application refuses to bill.                                                                                                                                                                                                                                      |
| Do not set                                     | `STRIPE_SHOP_WEBHOOK_SECRET` (the merchandise shop is dormant)                                                                                                                                                                                                                                                                                                     |

Verify with `node scripts/check-subscriptions.mjs`. It makes read-only GET requests, prints no values, and must report "matches STRIPE_ACCOUNT_ID" with both Prices valid.

## Secret-rotation runbook (manual; nothing was rotated by this phase)

1. **Exposed TEST webhook signing secret** (`whsec_`, from the main worktree's `.env.local`, account `…QcbIqtkyQF…`).
   - **Where it was exposed:** printed twice in the 25 Sep 2026 Claude Code session (so present in `~/.claude/projects/-home-stuart-worktrees-mtm-stripe/14c610ec-….jsonl`), and also present in `~/.codex/shell_snapshots/01a09101-….sh` and the 12 Sep tarball. It is not in any Git history.
   - **Rotate:**
     1. In that account's TEST Dashboard, go to Developers → Webhooks, then **Roll secret** on every test endpoint. If the secret came from `stripe listen`, run `stripe logout && stripe login` to re-pair; the CLI then issues a new secret.
     2. Update the local `.env.local`.
     3. Vercel's `STRIPE_WEBHOOK_SECRET` is marked sensitive, so it can't be compared. Replace it anyway during the Stripe setup above.
   - **Verify:** an event signed with the old secret is rejected (400).
2. **TEST secret key in the Codex snapshot** (belongs to `acct_1UET7hEFFFx3tee4`; still valid). Roll it via Developers → API keys → Roll, then update the Phase 4/5 worktree `.env.local`. The main worktree's key is already expired: just delete it from its `.env.local`.
3. **Resend API key in the Codex snapshot** (a real sending credential).
   - In Resend, create a new **sending-only** key restricted to the `moraltree.media` domain, set it locally, and delete the old key.
   - Vercel has no `RESEND_API_KEY` today; add the new one only when email is configured.
4. **Vercel values.** During the Stripe setup, replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, remove the misnamed Price variables, and add `STRIPE_PRICE_*` and `STRIPE_ACCOUNT_ID`. Every value must be marked Sensitive.
5. **After rotation:**
   - Delete the Codex snapshot.
   - `chmod 600` both `.env.local` files.
   - Re-create the backup encrypted, then remove the unencrypted tarball.
   - Optionally delete the session transcript. The secret is inert once rotated.

## Preview deployment procedure

Allowed once this branch is committed and pushed with approval. SSO protection already covers preview deployments.

1. Provision a preview database or branch. Apply migrations with `migrate.mjs apply --confirm-target …` against its direct endpoint, then `status`.
2. Set **Preview-scoped** Vercel variables:
   - `SUBSCRIPTIONS_DATABASE_URL` (pooled, verify-full)
   - Stripe TEST values from the canonical account
   - Resend, the audio origin/token and `ATTRIBUTION_COOKIE_SECRET`
   - `NEXT_PUBLIC_SITE_URL` = the preview origin
   - `SUBSCRIPTIONS_ENABLED=true`
   - `ADMIN_ANALYTICS_ENABLED` and `ADMIN_EXPORTS_ENABLED` unset
   - `LISTENING_TELEMETRY_ENABLED` unset
3. `vercel` (without `--prod`) from `apps/web`. Point a TEST webhook endpoint at the preview origin.
4. Acceptance on the preview:
   - `/free30` registration → email → verification → library → audio
   - Checkout (test cards: success, decline, 3DS)
   - Portal, cancellation, duplicate webhook redelivery
   - `check-subscriptions.mjs` against the preview variables
5. Optionally, enable the console for one verified founder UUID on the preview only and review every view. Enable exports only after that review.

## Production deployment procedure (not executed; each step has a stop condition)

1. **Git.** The reviewed release SHA (this branch merged with `main`, conflicts resolved as tabled above) is pushed, and CI is green. **STOP** if the SHA differs or CI fails.
2. **Infrastructure ready.** The database specification above is met, the restore test is recorded, the Stripe configuration check passes, and secrets have been rotated. **STOP** on any gap.
3. **Baseline.** `migrate.mjs status` against production: 001–004 pending, no problems. **STOP** otherwise.
4. **Migrate.**
   - `migrate.mjs apply --dry-run`, then `apply --confirm-target <db>@<host>`, then `status`.
   - Expect 001–004 applied with matching checksums.
   - **STOP** on any error; nothing partial can persist.
5. **Grants.** Apply the post-migration `REVOKE`s from the roles section.
6. **GATE — existing Stripe webhook endpoints (mandatory before any deploy or webhook activation).**
   - In the Stripe Dashboard of **every** account that has ever been configured for this site (the canonical TEST account, the other TEST account found locally, and whichever account Vercel's current `STRIPE_SECRET_KEY` belongs to), list Developers → Webhooks, test and live mode.
   - Identify every endpoint whose URL is `…/api/stripe/webhook` (on `moraltree.media` or any preview origin).
   - For each one, record its URL, mode, subscribed events and status. Then **disable** it, or **retarget** it to `/api/subscriptions/webhook` only if it is the canonical TEST account's endpoint, the event list matches `STRIPE_SUBSCRIPTIONS_V1.md`, and its secret is rolled and stored as `STRIPE_WEBHOOK_SECRET`. Never keep two endpoints in the same account delivering subscription events to this site, and never reuse the old endpoint's secret for the new one.
   - Why: after this deploy `/api/stripe/webhook` returns 503 (it now needs `STRIPE_SHOP_WEBHOOK_SECRET`, deliberately unset). An endpoint left pointing at it produces failing deliveries, warning emails and eventual auto-disable. Two live subscription endpoints would mean duplicate or conflicting delivery.
   - **STOP** until the result is recorded: no enabled endpoint targets `/api/stripe/webhook`, and at most one endpoint per account targets `/api/subscriptions/webhook`.
7. **Vercel Production variables.**
   - Set them, with `SUBSCRIPTIONS_ENABLED` still **unset**, the console, exports and telemetry unset, and the misnamed variables removed. `STRIPE_SHOP_WEBHOOK_SECRET` stays unset.
   - Deploy with `vercel --prod`.
   - Smoke-test the public routes (200s) and `/free30` in its disabled mode (honest message).
   - `/admin` and `/api/admin/export` must return 404.
8. **Stripe.** Re-confirm the step 6 gate (no endpoint added or re-enabled meanwhile). Then point the one canonical TEST endpoint at `https://moraltree.media/api/subscriptions/webhook`, set `SUBSCRIPTIONS_ENABLED=true` and redeploy. **STOP** if the gate no longer holds.
9. **Verify.**
   - The full TEST journey.
   - Webhook deliveries return 2xx, with no deliveries recorded against `/api/stripe/webhook`.
   - Ledger rows appear, and `check-subscriptions.mjs` passes.
   - **STOP** and roll back on repeated 503s.
10. **Console.** Enable `ADMIN_ANALYTICS_ENABLED` with exactly one approved founder UUID. Verify every view, then verify that a non-founder session gets a 404 and an anonymous request gets a 404/403.
11. **Exports.** Enable only after separate approval. **Telemetry and live billing stay OFF.**
12. **Monitor** at 1 h, 24 h and 72 h: Vercel runtime errors, Stripe webhook failures, pooler connections.

## Rollback

- **Code.** Promote the previous production deployment (currently `dpl_7CL1QQEv…`) in Vercel, then unset `SUBSCRIPTIONS_ENABLED` and the console variables.
- **Database.** Migrations 001–004 are additive and harmless to older code, so **leave them in place**. Never hand-edit the ledger.
- **Stripe.** Disable the new endpoint if needed. Stripe retries failed deliveries (for up to three days in live mode, fewer attempts in test mode), and missed events can be re-sent from the Dashboard.
- **Data corruption only.** Restore via PITR to a new branch, verify it, then repoint. Never restore over the live database without explicit approval.

## Remaining operator actions

1. Decide the canonical Stripe TEST account; configure Prices, the endpoint and the Portal (above).
2. Rotate the secrets (above). Fix file permissions; encrypt the backup and copy it off-host.
3. Provision managed PostgreSQL to the specification; run a restore test.
4. Configure Resend (verified sender) and the private audio origin/token; import at least 30 real curated stories into `mtm_library`.
5. Review and commit this branch; merge with `main`, superseding `6746516`'s subscription code.
6. Run the preview deployment and acceptance tests. Then production, following the procedure above.
7. Separately approve: the Founder Console, then exports, then (much later) listening telemetry and live billing.

## Verification record

Final run, 25 Sep 2026, on the loopback test cluster only:

- **Guarded runner:** 467 tests passed across 46 files, **none skipped**. The Phase 4 baseline was 386; 81 were added or updated.
  - New files: policy 11, migrations 12, pool 1, export audit 3, export rules 11, export route 16, Stripe config 5, subscription webhook route 14, secret leakage 8, telemetry off 3, Stripe events 2, merchandise webhook 5, `/free30` journey 7, test hygiene 2.
- **Retained data:** fingerprints were taken at session start and end (original algorithm and tables): runner `fadf7e09…`, whole `public` `cf16862a…` over 22 tables. They are identical, and only the `public` schema exists afterwards.
- **Runner hygiene:** no orphan processes and no leftover schemas.
- **Static checks:** `npm run lint`, `npm run typecheck` and `npm run format:check` pass. `next build` passes with subscriptions disabled and with them enabled.
- **Secret scan:** 410 files, 0 findings, 0 env files.
- **Migration CLI against a disposable schema:** status, dry run, refusal without the exact `--confirm-target`, `--through 002`, the remaining migrations, then a no-op re-run. A remote URL without `verify-full` was refused without echoing it.
- **Read-only `status` of the retained test `public` schema:** correctly reports an **unmanaged schema (baseline required)**; nothing was written.
- **Production-build smoke test** (`next start -H 127.0.0.1`, random port, subscriptions disabled). It bound loopback only.

  | Route                                         | Result              |
  | --------------------------------------------- | ------------------- |
  | `/`, `/free30`, `/subscribe`, `/story-worlds` | 200                 |
  | `/admin`, `/api/admin/export`                 | 404                 |
  | `/api/admin/overview`                         | 403                 |
  | `/library`                                    | 307 to `/subscribe` |
  | `/api/subscriptions/entitlements`             | 401                 |
  | Both webhooks (POST)                          | 503                 |

  No credential-shaped text appeared in the server log. The ad-hoc harness's `setsid` forked, so its group kill missed the server. It was then identified by port, run marker and start time, and stopped. The 20 pre-existing dev servers and all services were verified untouched.

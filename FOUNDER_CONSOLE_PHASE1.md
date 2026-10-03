# Founder Console — Phase 1

Private, read-only Founder/Admin dashboard at `/admin`, restored from the
previously approved console (historical commit `664e11f`, preserved as
`preservation/founder-console-phase1-2026-10-03`) into the redevelopment
application.

## Approval record

- **Visually approved by Stuart Taylor on 3 October 2026** (private
  loopback review of this exact implementation).
- Built on the approved audiobook checkpoint `0992216` (Approved audiobook
  carousel and player v1), which this work does not modify.
- **NO PRODUCTION DEPLOYMENT.** Nothing here has been pushed or deployed.
  The console is off by default; with `FOUNDER_CONSOLE_ENABLED` unset (true
  in every environment, including Vercel production) `/admin` is the site's
  ordinary 404.

## Scope

In Phase 1: the approved overview dashboard (sidebar, Founder/Admin badge,
subscribers, plans, trial metrics, subscription status breakdown, geography
placeholder, recent activity, system health, metric definitions), private
Founder access, and a read-only data adapter.

Not built (later phases): Finance & Subscriptions, Story Production,
Content Inventory & Publishing, System Administration, Merlin/Story Factory
integration. No `/api/admin` endpoint exists. `lib/admin/adminOperations.ts`
(the unrelated, unimplemented campaign-admin contract) is untouched.

## Files

| Path                                        | Role                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/app/admin/page.tsx`           | `/admin` — authorization, then Dashboard; 404 otherwise                       |
| `apps/web/src/app/admin/Dashboard.tsx`      | Approved UI, adapted to this app's data                                       |
| `apps/web/src/app/admin/admin.module.css`   | Approved styles (verbatim from `664e11f`) + one appended chrome/sign-in block |
| `apps/web/src/app/admin/actions.ts`         | Server Actions: complete sign-in, sign out                                    |
| `apps/web/src/app/admin/sign-in/page.tsx`   | One-time link landing page (404 unless the token is valid)                    |
| `apps/web/src/lib/founder/token.ts`         | HMAC-signed tokens (shared by server and CLI)                                 |
| `apps/web/src/lib/founder/policy.ts`        | Role grants and configuration, deny-by-default                                |
| `apps/web/src/lib/founder/session.ts`       | Cookie settings, one-time-use and revocation stores                           |
| `apps/web/src/lib/founder/auth.ts`          | `requireFounder()` — the single authorization gate                            |
| `apps/web/src/lib/founder/overview.ts`      | Read-only Sanity aggregates                                                   |
| `apps/web/src/lib/founder/fixture.ts`       | Labelled development review figures                                           |
| `apps/web/src/lib/founder/types.ts`         | Overview shape (counts only)                                                  |
| `apps/web/src/lib/founder/*.test.ts`        | Token, policy, access-boundary and view tests                                 |
| `apps/web/scripts/founder-sign-in-link.mjs` | Operator CLI that mints a one-time sign-in link on the server                 |

## Security model

`requireFounder()` runs server-side on every `/admin` request and inside
every Founder Server Action. All of the following must hold, otherwise the
caller gets `notFound()` — the site's ordinary 404, with no console title,
copy, styles or chrome change:

1. `FOUNDER_CONSOLE_ENABLED === "true"`.
2. `FOUNDER_SESSION_SECRET` is at least 32 characters.
3. `FOUNDER_ROLES` is a valid JSON map of 1–20 opaque Founder IDs to
   `"founder"` or `"admin"` (anything malformed denies everyone).
4. The `mtm_founder_session` cookie carries a valid HMAC-SHA256 signature
   (timing-safe comparison), purpose `session`, unexpired, at most 8h
   lifetime.
5. That session has not been revoked by sign-out.
6. Its Founder ID still holds a role now (removing a grant or rotating the
   secret revokes access on the next request).

**Sign-in** has no public form, API or URL that creates access. A one-time
link is minted on the server by `scripts/founder-sign-in-link.mjs` using the
same server-only configuration, so access requires shell access to the
server. Link tokens have purpose `sign-in` (never valid as a session), last
10 minutes and work once. Rendering `/admin/sign-in` does not consume the
token (link previews can't burn it); the explicit "Continue" POST
re-verifies, consumes it, and sets the session cookie.

**Session cookie:** HttpOnly, `SameSite=Strict`, `Path=/admin`, 8h, `Secure`
on every host except plain-HTTP loopback (private review runs over an SSH
tunnel at `http://localhost`). Sign-out revokes the session server-side and
clears the cookie.

**Isolation:** Founder modules that touch configuration, cookies or data
import `server-only`; customer-facing code never imports `lib/founder`. The
corporate header/footer/cookie banner are hidden only while an authorised
console view is on the page (a `body:has(.chromeless)` rule in the
console's own CSS module), so no shared layout file changed and
unauthorised requests keep normal chrome. Authorised pages are
force-dynamic (`no-store`), `noindex,nofollow`, `referrer: no-referrer`.

## Configuration

Server-only variables, documented with placeholders in
`apps/web/.env.example`. Never use `NEXT_PUBLIC_` for any of them and never
commit real values.

| Variable                         | Purpose                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `FOUNDER_CONSOLE_ENABLED`        | `true` to enable; anything else = `/admin` is a 404                               |
| `FOUNDER_SESSION_SECRET`         | ≥ 32-char HMAC secret; rotating it signs everyone out                             |
| `FOUNDER_ROLES`                  | e.g. `{"<founder-id>":"founder"}`                                                 |
| `FOUNDER_CONSOLE_REVIEW_FIXTURE` | `true` = labelled development figures when no records store exists (never Vercel) |

## Data

Read-only aggregates over the application's own Sanity `subscription`
records (written by the WP17 Stripe webhook and `lib/trialRegistration.ts`),
via the server-only token client. The query returns counts and bare
timestamps only — never `customerEmail`, `correlationRef`, document IDs,
Stripe IDs, campaign or partner fields (enforced by a test). No new
database, no migrations, no Stripe or Shopify calls.

| Metric                     | Definition                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active paid subscribers    | Records with status `active`                                                                                                                                                                |
| Active trial users         | Card-free platform trials, status `trialing`, unexpired `trialEnd`                                                                                                                          |
| Canceled subscribers       | Stripe-backed records with status `cancelled`                                                                                                                                               |
| Monthly / annual paid      | Active records by stored plan                                                                                                                                                               |
| Started trials             | Platform trial records with `trialStartedAt`                                                                                                                                                |
| Subscription status        | Exclusive buckets: active, canceling at period end, Stripe trialing, platform trial, platform trial (expired), past due, unpaid, paused, incomplete, canceled, platform trial closed, other |
| Recent activity            | Latest 20 trial-start / checkout / cancellation timestamps                                                                                                                                  |
| Stripe integration         | TEST key, webhook secret and price configuration presence only — never a live probe                                                                                                         |
| Last Stripe-updated record | Latest `updatedAt` on a webhook-written record                                                                                                                                              |

Always "Not yet available" in Phase 1 (no reliable source exists in this
application): registered accounts, revenue (today/week/month/lifetime),
MRR, successful payment-event counts, converted trials, trial-to-paid
conversion, churn, country breakdown, duplicate protection, failed webhook
deliveries, failed payment events. Records are not unique people.

With no Sanity project configured (the case everywhere today) the console
shows "No subscription data connected" and no figures. The review fixture
is used only when explicitly flagged, off Vercel, with no real records
store, behind authorization, and is labelled "Development test figures —
not business data" throughout.

## Private review procedure

The review server must bind to `127.0.0.1` only (never `0.0.0.0`, never
behind the public reverse proxy). Keep the Founder variables in a private
file **outside the repository** (mode 600), then from `apps/web`:

```sh
# Serve the production build on loopback only
node --env-file=<private founder env file> \
  node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3941

# Mint a one-time sign-in link (prints http://localhost:3941/admin/sign-in?token=…)
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --env-file=<private founder env file> \
  scripts/founder-sign-in-link.mjs <founder-id>
```

From the reviewer's machine: `ssh -N -L 3941:127.0.0.1:3941 <user>@<server>`,
open the link within 10 minutes, click **Continue to Founder Console**, and
use **Sign out** when finished. Never paste a sign-in link into chat or
email.

## Known limitations

- One-time sign-in and sign-out revocation are tracked in memory per server
  process: correct for a single review server, not yet for a
  multi-instance deployment. A production identity system (shared store or
  identity provider, with MFA) replaces `session.ts` and the CLI behind the
  same `requireFounder()` seam before any production activation.
- No MFA or step-up authentication — acceptable only because Phase 1 is
  read-only.
- A request-time 404 from an existing route is structurally slightly
  different from a 404 for a path with no route at all (framework
  behaviour); no console content is exposed either way.

## Validation at checkpoint

Lint, typecheck, the full test suite, and a `USE_MOCK_CONTENT=false`
production build were run before the checkpoint commit; see the commit
message for results. The audiobook implementation from `0992216` is
byte-identical.

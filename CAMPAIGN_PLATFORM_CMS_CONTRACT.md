# Campaign platform — CMS/admin data contract

Status: **no real Sanity project or admin service exists yet** (see
CLAUDE.md). This document does not describe something built — it
describes the shape any future content/admin system must satisfy to
plug into the campaign platform (`/start/[storyWorld]/[campaign]`,
`/s/[shortCode]`) without the front end changing. Written at the end of
Phase 3, updated at the end of Phase 4; keep it current as the
schemas/repository/query layer evolve.

## Why this document exists

Per the architecture proposal and the owner's Phase 3 instruction: don't
invent a substitute database, and don't pretend CMS-backed
administration exists. What's actually true today:

- The **real schemas already exist** in `apps/studio/schemaTypes/
documents/{partner,campaign,storyWorld}.ts` — a future Sanity project
  needs no new schema work, just content entered against what's already
  defined.
- Every query function this contract describes **already tries Sanity
  first** (`sanityFetch()`, `lib/sanity/client.ts`) and only falls back
  to local fixtures when `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset. Once
  a real project exists and is populated, the fallback branch simply
  never executes again — **no app code changes required** for that
  cutover.
- Until then, `lib/mockContent.ts` (purely fictional demo content) and
  `lib/devRecords.ts` (River Rangers — real IP, provisional values;
  International Water Company — entirely fictional test partner) stand
  in. Neither is a database; both are plain TypeScript modules, checked
  into source control, with no persistence or admin UI of their own.
  **Nothing in either file should be treated as seed data for a real
  migration without explicit review** — see each file's own doc comment
  for exactly what's provisional vs. fictional.

## The repository abstraction (Phase 4)

Data access is now a formal interface, `CampaignRepository`
(`apps/web/src/lib/repository/types.ts`), with two implementations —
`sanityRepository.ts` (real Sanity, inert until configured) and
`mockRepository.ts` (today's only working one, backed by
`mockContent.ts`/`devRecords.ts`) — composed Sanity-first/mock-fallback
by `repository/index.ts#defaultCampaignRepository`. **A future Sanity
population is a third possible starting point for this same interface's
`sanityRepository.ts` implementation to start actually returning data —
it is not a new interface, and not a new caller.**

The interface is deliberately data-access-only: `findCampaignByRoute`,
`findCampaignsByShortCode`, etc. return whatever record matches, with
**no status/lifecycle filtering and no permission check inside either
adapter**. Those live in `apps/web/src/lib/campaignRules.ts` (permission
and lifecycle rules — data-source-agnostic, called by the service layer
in `lib/sanity/queries.ts` on whatever a repository returns) and
`lib/theme/resolveTheme.ts` (theme resolution). A future third
implementation of `CampaignRepository` must not reimplement either — if
it feels like it needs to, the business logic has leaked into the wrong
layer.

## Campaign lifecycle & dates (Phase 4)

`CampaignDoc.status` (admin-set) is `"draft" | "scheduled" | "active" |
"paused" | "archived"` — **not** `"expired"`, which is never stored.
`lib/campaignRules.ts#resolveCampaignLifecycleStatus(campaign, now)`
computes the actual, request-time lifecycle state from `status` +
`startDate`/`endDate`:

- `draft` / `paused` / `archived` win outright, regardless of dates (an
  admin override always takes effect immediately).
- Otherwise, `now < startDate` → `scheduled`; `now > endDate` →
  `expired`; else → `active`.

This means an "active"-stored campaign automatically becomes `scheduled`
before its start date and `expired` after its end date with **no
background job and no admin edit required** — every read is already
request-time. `endDate` absent = no expiry (a supported, intentional
shape). `timezone` (IANA zone, e.g. `"Europe/London"`) is display/input
convenience only for a future admin UI; `startDate`/`endDate` are
already-stored UTC instants, so nothing needs to convert `timezone` at
resolution time.

`getCampaignForRoute` 404s for anything not resolved as effectively
`active` — a `/start/...` link to a paused/expired/scheduled/draft/
archived campaign behaves exactly like a missing one. `/s/[shortCode]`
is the one place this differs on purpose: see the short-code section
below.

## Short codes & QR generation (Phase 4)

`AcquisitionSourceField.shortCode` must be unique **platform-wide**, not
just per campaign — enforced two ways: Studio-side
(`uniqueShortCodeValidation`, `apps/studio/schemaTypes/lib/
uniqueShortCode.ts`, checking both sibling entries in the same document
and every other campaign) and read-time (`getCampaignByShortCode`
returns `{status: "collision"}` if more than one match is ever found,
rather than guessing). A future data source must preserve **both**
checks, or at minimum the read-time one — Studio-side validation only
protects data entered through Studio.

`getCampaignByShortCode` returns one of four outcomes
(`ShortCodeResolution`, `lib/sanity/queries.ts`): `not-found`,
`collision`, `inactive` (a real, permitted campaign that isn't
effectively active right now — includes an individually deactivated
acquisition source, reported via its own `reason: "source-disabled"`),
or `active`. `/s/[shortCode]/route.ts` redirects `inactive` to
`/campaign-unavailable` (Phase 5 — see that section below; a Phase 4
draft of this redirected to the bare homepage instead) — the printed
code isn't broken, the campaign behind it just isn't running — and 404s
for `not-found`/`collision`.

QR image generation is a separate, one-way concern:
`lib/qr/types.ts#QrGenerator` is the contract; `lib/qr/
localQrGenerator.ts` (backed by the local, free, MIT-licensed `qrcode`
package — no network calls, no API key, no paid service) is the only
implementation. `lib/qr/shortLinkUrl.ts#buildShortLinkUrl` is the one
function anything generating a code should call to get the URL to
encode — always a `/s/[shortCode]` URL, never a `/start/...` URL or a
raw campaign slug, so a printed code survives a campaign rename. No bulk
generation exists or is planned here — see the Phase 4 report.

## Custom domains (Phase 4 — configuration model only, no routing wired)

Two levels, both optional: `PartnerDoc.customDomains` (an array — a
partner subdomain or custom domain, each optionally pointing at a
`targetCampaign`) and `CampaignDoc.customDomain` (a single dedicated
domain for one campaign). `CampaignRepository.findByDomain(domain)` /
`getDomainMapping(domain)` resolve either shape to
`{partnerKey?, campaignKey?}` — **stable identifiers, never raw
content** — so a domain can never bypass `getCampaignForRoute`/
`getPartnerByKey` and the permission/theme rules a normal request goes
through. **Not called from `src/proxy.ts` or anywhere in the actual
request path** — real host-based routing needs real DNS/domain
verification first (architecture proposal §13), which remains
external/out of scope. This is the configuration model and resolution
contract only.

**Phase 5 — explicitly deferred, not started.** Wiring
`getDomainMapping` into `src/proxy.ts` (matching an incoming request's
`Host` header, rewriting to the resolved partner/campaign, exactly like
the legacy-domain redirects `next.config.ts` already does for
`moraltreemedia.com`) is the only code change actually required when
real custom domains arrive. Prerequisites, none of which exist yet:

- A real domain purchased/pointed at this project (DNS) for at least one
  pilot partner or campaign.
- That domain attached and verified in Vercel (or equivalent), so TLS
  and routing resolve at the platform level before any application code
  runs.
- A decision on `CustomDomainField.verified`'s source of truth — today
  it's a plain boolean an admin would flip by hand; a real integration
  should decide whether that stays manual or is driven by a verification
  API.

Nothing about `CampaignRepository`, `findByDomain`, or the two schema
fields needs to change for any of the above — this section exists so
that work starts from "wire the Host-header check into proxy.ts", not
from redesigning the data model.

## Campaign Unavailable (Phase 5)

A real, permitted campaign that isn't currently `active`
(draft/scheduled/paused/expired/archived, or a single acquisition
source individually deactivated) redirects from `/s/[shortCode]` to
`/campaign-unavailable?reason=<category>&code=<shortCode>` instead of a
dead-end 404 or the bare homepage (see that route's and that page's own
doc comments for the full design). Both query params are non-
identifying — `reason` is a generic lifecycle category, `code` is the
short code the visitor already possesses — so nothing about which
Partner/Story World/campaign was involved is ever visible in the URL, a
server log of it, or the rendered page, beyond text an admin explicitly
opted into via `CampaignDoc.unavailableMessage` (optional, defaults to
neutral, reason-based copy when unset). A genuinely unknown or colliding
short code still 404s exactly as before — it never reaches this page,
which is what keeps "this code never existed" distinguishable from
"this code is real but not running".

## The data contract

Any future content source (Sanity, or another approved admin/data
service) must be able to produce objects shaped like these — the exact
TypeScript interfaces in `apps/web/src/lib/sanity/types.ts`:

### `ThemeTokensFields` (shared by Partner/StoryWorld/Campaign)

| Field                          | Type      | Notes                                   |
| ------------------------------ | --------- | --------------------------------------- |
| `colors.brand`                 | `string?` | Hex. Equivalent to `--color-brand-600`. |
| `colors.brandDark`             | `string?` | Hex. `--color-brand-700`.               |
| `colors.onBrand`               | `string?` | Hex. `--color-on-brand`.                |
| `colors.headingAccent`         | `string?` | Hex. `--color-heading-accent`.          |
| `colors.surface`               | `string?` | Hex. `--color-surface`.                 |
| `colors.surfaceSubtle`         | `string?` | Hex. `--color-surface-subtle`.          |
| `colors.accentGold`            | `string?` | Hex. `--color-accent-gold`.             |
| `typography.headingFontFamily` | `string?` | CSS font-family value.                  |
| `typography.bodyFontFamily`    | `string?` | CSS font-family value.                  |

**Deliberately excluded, permanently:** any field corresponding to
`--color-text`, `--color-text-muted`, or `--color-border`. These are not
optional-and-usually-unset — they do not exist in this shape at all. A
future admin UI must not add input controls for them; a future data
source must not be asked to supply them. See `lib/theme/types.ts`'s doc
comment and the accessibility section below for why.

### `PartnerDoc`

| Field                                                                  | Type                                               | Admin-editable?                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| `key`                                                                  | `string`, immutable once real campaigns exist      | Set once at creation                                                  |
| `slug`                                                                 | `string`, editable                                 | Yes                                                                   |
| `name`, `logo`, `favicon`, `heroImagery`                               | —                                                  | Yes                                                                   |
| `theme`                                                                | `ThemeTokensFields`                                | Yes, subject to contrast validation                                   |
| `brandingTier`                                                         | `"full-mtm" \| "co-branded" \| "near-white-label"` | Yes                                                                   |
| `broughtToByText`, `showBroughtToBy`, `poweredByText`, `showPoweredBy` | —                                                  | Yes                                                                   |
| `footerCopy`, `legalLinks`, `supportContact`                           | —                                                  | Yes                                                                   |
| `customDomains`                                                        | `[{domain, verified, targetCampaign}]`             | Yes (verification itself is external — see architecture proposal §13) |
| `permittedStoryWorlds`                                                 | reference list                                     | Yes — enforced at read time, see below                                |
| `offerRules`, `analyticsIds`                                           | —                                                  | Yes                                                                   |
| `status`                                                               | `"active" \| "inactive"`                           | Yes                                                                   |
| `internalNotes`                                                        | `string?`, staff-only, never rendered              | Yes                                                                   |

### `StoryWorldDoc` (campaign-platform fields; corporate fields omitted, unchanged since WP6)

| Field                  | Type                                                          | Admin-editable?                                                                                |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `key`                  | `string`, immutable                                           | Set once                                                                                       |
| `theme`                | `ThemeTokensFields`                                           | Yes                                                                                            |
| `characterRoster`      | `[{name, portrait, relativeScale, approvedForCampaign}]`      | Yes                                                                                            |
| `campaignDefaults`     | `{headline, supportingCopy, ctaLabel, benefits[], trustCopy}` | Yes                                                                                            |
| `audiobookContentRefs` | `string[]`, opaque external IDs                               | Yes (display only — see the architecture proposal on why this is never a second content store) |
| `trialProductMapping`  | `string?` (Stripe Price ID, display only)                     | Yes                                                                                            |
| `internalNotes`        | `string?`                                                     | Yes                                                                                            |

### `CampaignDoc`

| Field                                                                                                                                            | Type                                                                                                                          | Admin-editable?                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `key`                                                                                                                                            | `string`, **globally unique, immutable** (owner-confirmed Phase 1 decision)                                                   | Set once                                                                                                                                                                             |
| `slug`                                                                                                                                           | `string`, editable, scoped for routing display only                                                                           | Yes                                                                                                                                                                                  |
| `partner`, `storyWorld`                                                                                                                          | references, both optional                                                                                                     | Yes                                                                                                                                                                                  |
| `theme`                                                                                                                                          | `ThemeTokensFields`                                                                                                           | Yes                                                                                                                                                                                  |
| `offer.offerType`                                                                                                                                | `"free-trial" \| "percentage-discount" \| "fixed-offer" \| "reward-linked"`, optional                                         | Yes — see the registration-journey section below for backward compatibility                                                                                                          |
| `offer.trialLengthDays`, `offer.discountPercentage`, `offer.fixedOfferLabel`, `offer.rewardRuleKey`, `offer.stripePriceId`, `offer.discountCode` | —                                                                                                                             | Yes (`stripePriceId` is display/checkout-initiation only — see the Stripe section below; `rewardRuleKey` is an opaque, unvalidated reference — see the registration-journey section) |
| `headline`, `subheadline`, `heroImageOverride`, `ctaWording`, `supportingCopyOverride`                                                           | —                                                                                                                             | Yes                                                                                                                                                                                  |
| `sectionOverrides`                                                                                                                               | `Array<"offer" \| "benefits" \| "storyWorldIntro" \| "trust">`                                                                | Yes                                                                                                                                                                                  |
| `startDate`, `endDate`                                                                                                                           | ISO 8601, both optional (no expiry if `endDate` unset)                                                                        | Yes                                                                                                                                                                                  |
| `timezone`                                                                                                                                       | `string?`, IANA zone — display/input convenience only, see lifecycle section                                                  | Yes                                                                                                                                                                                  |
| `status`                                                                                                                                         | `"draft" \| "scheduled" \| "active" \| "paused" \| "archived"` — never `"expired"`, which is computed (see lifecycle section) | Yes                                                                                                                                                                                  |
| `trackingIdentifiers`                                                                                                                            | `{internalCode, defaultUtm}`                                                                                                  | Yes                                                                                                                                                                                  |
| `acquisitionSources`                                                                                                                             | `AcquisitionSourceField[]`                                                                                                    | Yes — see below                                                                                                                                                                      |
| `customDomain`                                                                                                                                   | `{domain, verified?}?` — see custom-domains section                                                                           | Yes                                                                                                                                                                                  |
| `unavailableMessage`                                                                                                                             | `string?` — see Campaign Unavailable section                                                                                  | Yes                                                                                                                                                                                  |
| `internalNotes`                                                                                                                                  | `string?`                                                                                                                     | Yes                                                                                                                                                                                  |

### `AcquisitionSourceField`

| Field         | Type                                                                                             | Notes                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`       | `string`                                                                                         | Human-readable, staff-only                                                                                                                                                                                                |
| `channelType` | `"qr" \| "social" \| "email" \| "whatsapp" \| "paid-ad" \| "print" \| "partner-site" \| "other"` | —                                                                                                                                                                                                                         |
| `code`        | `string`                                                                                         | The `src=` value this placement carries                                                                                                                                                                                   |
| `utmDefaults` | `{source?, medium?, campaign?, content?}`                                                        | Pre-filled UTM values                                                                                                                                                                                                     |
| `shortCode`   | `string?`                                                                                        | Only for `channelType: "qr"` — the `/s/[shortCode]` path segment. **Must be unique across all campaigns' acquisition sources** — `getCampaignByShortCode` (see below) matches on this value alone, with no other scoping. |
| `active`      | `boolean`                                                                                        | A deactivated source's short code fails safely (404) without deleting the record — see the short-link route's doc comment                                                                                                 |

## The query-function contract

Every function below already exists in `apps/web/src/lib/sanity/
queries.ts`, already Sanity-first/mock-fallback, and already covered by
`apps/web/src/lib/sanity/queries.test.ts`. A future data-source
migration's job is entirely on the Sanity/GROQ side of each function —
none of them need a new signature or a new caller.

| Function                                                                                         | Contract                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getCampaignForRoute(storyWorldSlug, campaignSlug)`                                              | `CampaignDoc \| null`. Null for: no match, not effectively `active` right now (`isCampaignEffectivelyActive` — draft/scheduled/paused/expired/archived, computed, not just the stored field), or `storyWorld` not in `partner.permittedStoryWorlds` (`isStoryWorldPermitted`). Never a partial/fabricated result. |
| `getCampaignIdentifiers(storyWorldSlug, campaignSlug)`                                           | `{key, partnerKey?, storyWorldKey?} \| null` — the tiny projection `src/proxy.ts` uses for attribution; same match rule as above minus the permission/lifecycle checks (see that function's own doc comment for why).                                                                                             |
| `getCampaignByShortCode(shortCode)`                                                              | `ShortCodeResolution` — a **discriminated union** (`not-found` / `collision` / `inactive` / `active`), not a nullable single shape. See the short-codes section above.                                                                                                                                            |
| `getDomainMapping(domain)`                                                                       | `{partnerKey?, campaignKey?} \| null` — see the custom-domains section. Not called from any request-routing path yet.                                                                                                                                                                                             |
| `getPartnerByKey(key)` / `getStoryWorldByKey(key)`                                               | `PartnerDoc \| StoryWorldDoc \| null` — standalone lookups by the immutable `key`, for a future admin surface or reporting view; not consumed by any route today.                                                                                                                                                 |
| `isStoryWorldPermitted(campaign)`                                                                | Pure function (`lib/campaignRules.ts`), not a query — the tenant-isolation guard.                                                                                                                                                                                                                                 |
| `campaignBelongsToPartner(campaign, partnerKey)`                                                 | Pure function (`lib/campaignRules.ts`) — the authorization check a future partner-scoped admin session would need before reading/editing a campaign. Not called by anything yet; ready for when something is.                                                                                                     |
| `resolveCampaignLifecycleStatus(campaign, now?)` / `isCampaignEffectivelyActive(campaign, now?)` | Pure functions (`lib/campaignRules.ts`) — see the lifecycle section above.                                                                                                                                                                                                                                        |

**Null-handling rule, restated for this contract specifically:** a
missing/inactive/unpermitted Campaign, Partner, or Story World is always
`null`, never a fabricated fallback object — matching rule 1 of
CLAUDE.md's existing null-handling framework (pure editorial content
404s honestly). A future admin/CMS integration must preserve this; it is
part of the contract, not an implementation detail of the current mock
fallback.

## What a future admin interface must support

**Phase 4: typed, not just documented.** Every operation below now has a
corresponding TypeScript interface in `apps/web/src/lib/admin/
adminOperations.ts` (`CreatePartnerInput`, `SetCampaignStatusInput`,
`AdminOperations`, etc.) — **nothing in that file is implemented**; it
exists so the shape of admin capability is settled and compile-checked
now, not invented alongside a real admin UI later. Building an
implementing class against fake/local persistence would be exactly the
kind of substitute backend this project has been told not to invent —
don't do that just because the interface exists.

**Phase 5 — explicitly deferred, not started.** No Sanity Studio
structure/tool or other admin surface was built this phase, and none
should be until a real, approved Sanity/admin environment exists — see
the owner's Phase 5 scope decision. What _is_ ready for that surface to
attach to, unchanged: the `AdminOperations` interface above; the
`CampaignRepository` abstraction (`lib/repository/`) it would read/write
through; and `lib/campaignRules.ts`'s permission/lifecycle logic, which
any admin action (e.g. `activateCampaign`) must call through rather than
reimplement. A real admin surface's job is to implement `AdminOperations`
against a real Sanity write client (`lib/sanity/writeClient.ts` already
exists for this, currently only used by the Stripe webhook) — no new
architecture, just a new implementation of contracts already defined.

create/edit a Partner; create/edit a Story World; assign a Story World
to a Partner (`permittedStoryWorlds`); create/edit a Campaign; set
branding (theme tokens, subject to the same contrast validation
`lib/theme/contrast.ts` already applies, surfaced via
`AdminValidationResult`); select/upload imagery (by reference/ID — see
`heroImageRef`-style fields, which assume imagery is uploaded to
whatever storage the real data source uses, not inlined here); edit
copy/CTA/offer; set dates/timezone and status (`SetCampaignStatusInput`,
kept separate from copy/theme/offer edits so a future UI can gate
activating/archiving behind its own confirmation step); manage
acquisition sources/short codes (`CreateShortCodeInput`, surfacing
`AdminValidationResult` for a collision); configure a partner or
campaign custom domain; and — because `key` fields are immutable by
design — the UI must either generate `key` once at creation and hide it
thereafter, or make changing it a deliberately separate, scary, audited
action, never a normal edit-and-save field.

## Accessibility guardrail — must survive any future admin/CMS

`ThemeTokensFields` has no `text`/`textMuted`/`border` fields (see
above) — this is the primary guardrail, and it holds regardless of what
system eventually writes these documents, because it's enforced by the
_shape_ of the data, not by admin-UI discipline. The secondary guardrail
— WCAG contrast validation on the seven fields that _are_ overridable —
lives in `lib/theme/contrast.ts` and runs at render time
(`resolveTheme`), so it applies no matter which system produced the
override. A future admin UI should surface a rejected override to
whoever authored it (today this only reaches a server log — see the
Phase 1 report's deferred items) but must not attempt to bypass or
duplicate the check itself.

## Adult registration, consent, and the subscription-ready handoff

Item 3–9 of the owner's registration-journey brief (adult-only
registration, communications consent, offer types, the handoff contract,
reward/voucher typed contracts, and conversion events) extend the
existing campaign platform rather than replacing any part of it — no QR/
short-code/attribution/landing-page architecture changed. Summary, with
the exact types as the source of truth:

- **Registration form** (`components/patterns/CampaignLanding/
SignupForm.tsx`) — the same form both `/free30` and every
  `/start/[storyWorld]/[campaign]` campaign share now collects the
  registering **adult**'s first/last name, email, and (optional) country,
  plus required adult/guardian confirmation and Terms/Privacy acceptance,
  and a separate, optional, unchecked-by-default marketing checkbox.
  Validation is shared (`lib/registration/validate.ts`) so both routes
  can't drift into two different definitions of "a valid registration."
- **Consent contract** (`lib/registrationConsent.ts`) —
  `RegistrationConsentState`, deliberately separate from `lib/consent.ts`
  (cookie-banner consent — an unrelated concern; see that file's own doc
  comment). Records `adultConfirmed`/`guardianConfirmed`, `termsAccepted`/
  `termsVersion`/`termsAcceptedAt`, `privacyAccepted`/`privacyVersion`/
  `privacyAcceptedAt`, and `marketingConsent`/`marketingConsentAt` —
  marketing consent is never a precondition for operational/service
  communications (trial reminders, subscription information, service
  notices).
- **Offer types** — `CampaignDoc.offer.offerType` (`"free-trial" |
"percentage-discount" | "fixed-offer" | "reward-linked"`) is additive
  and optional; every campaign created before this field existed has no
  value here, and every consumer treats a missing value as `"free-trial"`
  (its actual behaviour before this field existed) — no existing campaign
  needs a data migration.
- **Reward/voucher contract** (`lib/rewards/types.ts`) — **typed only, no
  redemption system**. `PartnerRewardRule`, `RewardTrigger`,
  `RewardEligibilityState`, `RewardEligibilityMetadata`. Deliberately not
  a Sanity document type yet (see that file's doc comment) — a real
  reward programme is a future, separately-approved admin/schema
  addition, not implied by this contract's existence.
- **Subscription-ready handoff** — `StartTrialRequest`
  (`lib/platform/contract.ts`) now carries the adult's identity
  (`AdultIdentity`), `partnerId`/`storyWorldId`/`campaignId`/
  `acquisitionSource`, an `OfferIdentity`, the full `attribution`
  (unchanged), `consent: RegistrationConsentState`, and an optional
  `rewardEligibility: RewardEligibilityMetadata`. The one implementation,
  `emailStandInPlatformClient`, still only emails a human — no account,
  entitlement, subscription, or reward is created or persisted anywhere.
- **Conversion events** (`lib/analytics/events.ts`) — a typed
  `ConversionEvent` union (landing viewed, CTA clicked, registration
  started/completed, trial activated, subscription handoff started, a
  subscription-outcome placeholder, reward eligibility), logged only
  (`consoleConversionEventSink`) until a real destination is chosen.
  Every event carries opaque IDs only — no name, email, or other PII, by
  construction of the types.

## Explicitly out of scope for this contract

Everything the architecture proposal assigns to the shared platform
backend or the external audiobook platform — accounts, auth,
entitlements, subscriptions, real trial provisioning, catalogue,
playback, and real reward issuance/redemption — is a **separate**
contract (`apps/web/src/lib/platform/contract.ts`'s `PlatformClient`
interface, and `lib/rewards/types.ts` for reward eligibility), not this
one. This document is about where Partner/Story-World/Campaign/
AcquisitionSource _configuration_ comes from; it says nothing about
accounts or billing, and nothing here should be read as proposing that
it should.

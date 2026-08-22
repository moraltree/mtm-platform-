# Progress log

Concise, dated record of autonomous work sessions on this repo. Full detail
lives in `git log`; current architecture/status lives in `CLAUDE.md`. Newest
entries first.

## 2026-08-22 — WP12: Adult registration, consent, offer types, reward contract, conversion events

- Task: extend the existing campaign-platform journey (QR/short-link →
  campaign landing → registration → subscription-ready handoff) with
  adult-only registration, separated communications consent, configurable
  offer types, a typed partner reward/voucher contract, and a typed
  conversion-event boundary — per the owner's brief, following an audit
  reported and approved first. Explicit instruction: reuse the existing
  QR/short-code/campaign/attribution/landing-page architecture, don't
  rebuild any of it.
- Audit finding (reported and approved before implementation): a
  substantial campaign platform already existed
  (`/start/[storyWorld]/[campaign]`, `/s/[shortCode]`, attribution
  cookies, `CampaignRepository`, `PlatformClient`, `AdminOperations`) but
  was undocumented in `CLAUDE.md` (built across a separately-tracked
  "Phases 0-5" engagement, checkpointed in `1ec92a5`) — the actual gaps
  were adult registration fields, consent capture, reward/voucher
  contracts, and conversion tracking, not the underlying architecture.
- `lib/registrationConsent.ts`: typed `RegistrationConsentState`
  (adult/guardian confirmation, Terms/Privacy acceptance with per-document
  version + timestamp, marketing consent kept separate and optional) —
  deliberately not merged with `lib/consent.ts` (cookie-banner consent).
- `lib/registration/validate.ts`: shared field/consent validation, used
  by both `/free30`'s and `/start/...`'s Server Actions so they can't
  drift into two definitions of "valid."
- `lib/rewards/types.ts`: typed-only partner-agnostic reward/voucher
  contract (`PartnerRewardRule`, `RewardTrigger`, `RewardEligibilityState`,
  `RewardEligibilityMetadata`) — no Sanity schema, no redemption logic, no
  partner named.
- `lib/analytics/events.ts`: typed `ConversionEvent` union covering all
  eight requested events, `consoleConversionEventSink` (log-only, no real
  destination), no PII in any payload by construction of the types.
- `lib/platform/contract.ts`: `StartTrialRequest` extended with
  `AdultIdentity`, `partnerId`/`storyWorldId`/`acquisitionSource`,
  `OfferIdentity`, `consent`, optional `rewardEligibility`;
  `emailStandInPlatformClient.startTrial` updated to include all of it in
  its (still human-only, still non-persistent) notification email, and to
  fire `subscription_handoff_started`/`reward_eligibility` events.
- `lib/sanity/types.ts` + `apps/studio/schemaTypes/documents/campaign.ts`:
  `CampaignDoc.offer` gained `offerType` (`free-trial` |
  `percentage-discount` | `fixed-offer` | `reward-linked`),
  `discountPercentage`, `fixedOfferLabel`, `rewardRuleKey` — all optional,
  backward-compatible (missing `offerType` still means `free-trial`, the
  behaviour every existing campaign already had).
- `components/ui/Checkbox` (new) and `FormField.tsx`'s new `SelectField`:
  accessible primitives (associated label, error announcement,
  required-field indicator) matching `TextField`'s existing pattern.
- `SignupForm.tsx` rewritten into a full adult-registration form
  (first/last name, email, optional country selector, required
  adult/guardian/Terms-Privacy checkboxes, separate optional marketing
  checkbox) — shared by `/free30` and every `/start/...` campaign, so
  both routes' registration flow grew together, not separately. Fires
  `cta_clicked`/`registration_started`/`registration_completed`;
  `CampaignLandingAnalytics` (new, invisible) fires
  `campaign_landing_viewed` once per page render, independent of which
  `SignupForm` instance mounts.
- `components/patterns/CampaignLanding/actions.ts` (`/free30`) and
  `app/start/[storyWorld]/[campaign]/actions.ts` rewritten to build the
  full consent/adult-identity/offer/reward payload and call through
  `emailStandInPlatformClient.startTrial` — `/free30` now also goes
  through the shared platform-contract call (previously its own inline
  `sendEmail`), carrying its own hard-coded "30 nights free" offer
  identity since it has no Sanity-backed Campaign document.
  `lib/attribution/fallback.ts` extracted the "no cookie" fallback both
  actions need (small dedup, `/start/...`'s own pre-existing logic moved
  verbatim, not changed).
- `app/start/[storyWorld]/[campaign]/page.tsx`: passes
  `campaignDoc.partner?.key`/`storyWorld?.key`/`offer` through to
  `CampaignLanding` as typed props, threaded into hidden form fields so
  the Server Action never re-queries Sanity itself.
- New tests: `lib/registrationConsent.test.ts`,
  `lib/registration/validate.test.ts`, `lib/analytics/events.test.ts`
  (17 new cases). Full suite: 108 passed, 0 failed (10 files). Lint,
  typecheck, and `prettier --check` all clean after an auto-format pass.
  `next build` verified clean both with `USE_MOCK_CONTENT=true` (36
  routes) and unset (25 routes, real null-handling paths). `next start` +
  curl confirmed the new fields/checkboxes/hidden fields render correctly
  on both `/free30` and `/start/river-rangers/river-rangers-water-safety`
  (the existing River Rangers dev fixture) — including partner/Story-
  World/offer hidden fields resolving correctly from the Sanity-shaped
  mock data.
- A Vercel **preview** deployment (not production) was created for manual
  mobile-width visual QA, since no browser-automation tool was available
  in this session — see the session's own report for the URL.
- Did not touch: `backend/`, DNS/domain config, Shopify integration,
  Story Worlds pages, existing corporate routes, the QR/short-code
  system, attribution-cookie mechanics, or any real Stripe/Sanity
  credentials. No customer database, entitlement persistence, voucher
  redemption, or new Stripe business logic was built — see
  `CAMPAIGN_PLATFORM_CMS_CONTRACT.md`'s updated "Explicitly out of
  scope" section.

## 2026-08-21 (session 5) — WP11 final pass: Story Worlds card sizing/balance

- Task: with the distortion/cropping fix (below) approved, one more
  homepage-only refinement — enlarge the Savannah Seven artwork
  moderately, reduce dead space around it, keep proportions/copy/CTAs/
  data exactly as they are, Hero untouched.
- Root cause found: `.storyWorldMedia`'s box was `aspect-ratio: 16/10`
  (1.6, landscape) against the actual ensemble photo's real 912x1136
  (~0.8, portrait, confirmed by reading the file directly — same fixed
  canvas size as every other asset in this pipeline, including Zulu's
  own hero pose). `object-fit: contain` was already correct, but had to
  letterbox nearly half the box away to fit a portrait image into a
  landscape frame — that gap _was_ the "excessive empty space."
- One CSS-only fix (`home.module.css`): `.storyWorldMedia`'s
  aspect-ratio → `4/5` (matches the real photo almost exactly, same
  ratio `Hero.module.css`'s `.media` already uses for the same reason —
  no letterboxing left to speak of, so the artwork itself reads
  noticeably larger for free). At the existing 64rem breakpoint,
  `.storyWorldLayout`'s `grid-template-columns` changed `1fr 1fr` → `6fr
5fr` (moderate skew toward the artwork) and gained `align-items: center`
  (the now-taller portrait card can exceed the shorter text column's
  height; centering avoids the text column pinning to the top with dead
  space beneath it). No other property changed.
- Verified: lint/typecheck/format clean; production-parity build; `next
start` + curl confirmed the compiled CSS has the new `4/5`/`6fr 5fr`/
  `center` rules, `.storyWorldMediaImage`/Hero's `.image` both still
  compile to `object-fit:contain` (zero `cover`), all copy/badges/CTAs/
  routes unchanged, the Savannah Seven detail page and Hero are
  untouched, and every previously-verified route/behaviour is unchanged.
  Not deployed — a fresh preview created for owner visual QA.

## 2026-08-21 (session 4) — WP11 fix: image distortion/cropping from the refinement pass

- Task: owner visual QA on WP11 (below) rejected it — the Hero crop cut
  into Zulu's lower body/raised hoof, and the Story World teaser's
  ensemble photo looked visibly squashed. Fix only, no redesign.
- Hero (`Hero.module.css`): reverted `.image` from `object-fit: cover` +
  `object-position: top` back to `object-fit: contain` (no cropping,
  full character always visible), and `.media`'s aspect-ratio from 4/3
  back to 4/5 (the source photo's own natural ~0.803 ratio, so `contain`
  needs no letterboxing). The `max-width: 22rem` mobile cap introduced in
  WP11 — the actual, correct fix for "oversized on mobile" — was kept
  unchanged; it alone (no crop needed) solves that complaint.
- Story World teaser image (`home.module.css`, `page.tsx`): root cause
  was a real bug, not a design choice — the `<Image fill>` for the
  ensemble photo had **no `object-fit` set at all**, so the browser's
  CSS-initial default (`fill`, i.e. stretch-to-box ignoring aspect
  ratio) silently squashed it to `.storyWorldMedia`'s 16/10 box. Added a
  new `.storyWorldMediaImage { object-fit: contain; }` class and applied
  it via `className` — same bug would have existed with the old
  `/placeholder.png` too, just unnoticed. `.storyWorldMedia`'s own 16/10
  box, all copy, badges, CTAs, and title styling from WP11 are
  unchanged.
- Verified: lint/typecheck/format clean; production-parity build; `next
start` + curl confirmed the compiled CSS has zero `object-position:top`
  occurrences and the correct `object-fit:contain`/`aspect-ratio:4/5`
  rules, both images still resolve to the correct real source files, and
  every previously-verified route/behaviour (Shopify nav, no cart icon,
  `/free30`, campaign routes, honest 404s, detail page's 8 characters)
  is unchanged. Not deployed — a fresh preview created for owner
  re-review.

## 2026-08-21 (session 3) — WP11: Story Worlds visual refinement pass

- Task: owner visual QA on WP10 found the _homepage's_ Hero and "Story
  World teaser" section — not the `/story-worlds` pages themselves —
  still showed stale placeholder treatment (a "Placeholder artwork"
  badge, a generic "Coming soon"/"Story World reveals coming soon" card,
  an oversized Zulu hero image) now that Savannah Seven is real. Scoped
  and approved: homepage Hero + Story World teaser, plus a small status
  badge on the `/story-worlds` index card. Detail page left untouched
  (no regression found, none needed).
- Homepage Story World teaser (`app/page.tsx`, `home.module.css`): now
  fetches the real `savannah-seven` Story World via the same
  `getStoryWorldBySlug` fallback chain WP10 built (Sanity → seed registry
  → mock), rather than hardcoding placeholder markup. Removed
  `/placeholder.png` and the "Placeholder artwork"/"Coming soon" badges
  entirely; card now shows the real title ("Zulu the Zebra & The
  Savannah Seven"), the approved tagline (reused verbatim from
  `/free30`), an honest "In development" status badge, and the full-cast
  ensemble photo already used elsewhere (via the Story World's own
  `gallery[0]`, not a separately hardcoded path — one source of truth).
  Title styling strengthened (`--text-2xl`, bold, `--color-heading-
accent` — same token as the Hero headline, contrast-audited against
  both backgrounds it now appears on; updated that token's own doc
  comment in `tokens.css` to reflect the second usage). Primary CTA now
  deep-links to `/story-worlds/savannah-seven`; a new secondary CTA links
  to `/story-worlds`. A null-`savannahSeven` fallback (generic "coming
  soon" markup) is kept for honest degradation if the registry entry is
  ever removed — not expected to trigger today.
- Homepage Hero (`Hero.module.css`, `Hero.tsx`) — same source image, no
  new artwork: `.media`'s aspect-ratio changed 4/5 → 4/3 and gained a
  `max-width: 22rem` (removed again at the existing 64rem two-column
  breakpoint, where the grid already sizes it reasonably) — the box
  itself, not letterboxing, was the real cause of the "almost a full
  viewport" complaint (previous 4/5 ratio was already within ~0.4% of
  the source photo's own ~0.803 ratio, so `object-fit: contain` had
  almost no letterbox to remove). `.image` switched `contain` → `cover`
  - `object-position: top center`: because the new box is wider-for-its-
    height than the source photo, `cover` only ever crops the vertical
    axis here, never horizontal — face/ears/mane and both ears' full width
    stay completely in frame at the top; only the lower torso/legs are
    trimmed. `sizes` updated to match (`22rem` mobile hint instead of
    `100vw`). Also used by `/style-guide` (an internal, noindexed
    design-system reference page) via the same shared component — flagged,
    not avoided, since that page exists specifically to reflect the real
    component styling.
- `/story-worlds` index (`page.tsx`): added the same "In development"
  status badge to the Card via its existing (previously unused) `meta`
  prop — already documented in `Card.tsx` as built for exactly this
  ("a status badge row (Story Worlds)").
- Verified: lint/typecheck/format clean; production-parity build
  (`USE_MOCK_CONTENT=false`); `next start` + curl confirmed zero
  placeholder references remain, real title/tagline/badge/ensemble image
  render, both CTAs point correctly, the compiled CSS contains the new
  `22rem`/`object-position:top` rules, the Savannah Seven detail page is
  byte-for-byte unchanged in content (hero, all 8 characters, badges),
  and every previously-verified route/behaviour (`/free30`, `/shop`,
  `/cart`, `/contact`, `/leadership`, `/news`, `/checkout/cancelled`,
  `/campaign-unavailable`, the Shopify nav link, no cart icon, honest
  404s for River Rangers/Firefly Hollow/Ocean World) is unchanged.
- Not touched: Shopify integration, Stripe/legacy shop code, `/free30`,
  campaign routes, Vercel config, audiobook/player infrastructure,
  accounts/entitlements, Publishing/Audiobooks/Animation section, any
  other corporate page. Not deployed to production — a fresh preview
  deployment was created instead for owner visual review.

## 2026-08-21 (session 2) — WP10: Story Worlds — Savannah Seven seed content

- Task: resume the corporate website build, Story Worlds first, following
  a read-only audit + approved proposal (Decisions A–D). Scope: make
  Savannah Seven genuinely visible on the live `/story-worlds` route now,
  keep the architecture multi-Story-World-ready, use only already-
  approved repo assets/copy, touch nothing Shopify/Stripe/`/free30`/
  campaign/Vercel-related.
- Audit found the WP6 route/template already fully generic (zero
  Savannah-specific code) — the actual gap was content, not page design.
  `getStoryWorlds()`/`getStoryWorldBySlug()` only ever fell back to
  `mockContent.ts`'s three fictional placeholders, gated off in
  production; Savannah's real, approved 8-character/6-pose asset library
  (`lib/characters.ts`) was wired only into `/free30` and the homepage,
  completely disconnected from the `storyWorld` schema/route. River
  Rangers already had a real, schema-shaped fixture
  (`lib/devRecords.ts`) but only reachable through the campaign
  platform's key-based lookup, not the corporate slug-based one.
- New `lib/storyWorlds/registry.ts`: a real (non-mock, non-gated)
  `StoryWorldDoc` fallback, consulted by `queries.ts` after a real Sanity
  result and before the mock-content fictional fixtures — explicitly
  temporary seed content, not a second CMS (a real Sanity document for a
  slug wins automatically the moment one exists). `lib/sanity/
image.ts#urlFor` gained one additive `local-file:` branch so the
  registry's real `public/` images resolve through the same
  `urlFor(x)?.width(n).url()` call site every other image already uses —
  verified this has zero effect on any existing Sanity/mock image
  anywhere else (the sentinel prefix can never collide with a real ref or
  `mockImage()`'s `"image-mock-…"` ref).
- Populated one entry: Zulu the Zebra & The Savannah Seven (`key:
"zulu"`, matching the schema's own established example; `slug:
"savannah-seven"`). `characterRoster` generated from
  `lib/characters.ts#getAllCharacters()` directly (not hand-duplicated —
  one source of truth for name/scale/image path). Hero image copied
  unmodified from the master asset library's own purpose-made
  `hero-03-story-worlds-index-card-crop-16x9.png` (`PRODUCTION_MANIFEST.md`
  Section 8, item 3 — produced specifically for `storyWorld.heroImage`);
  chose the 16:9 crop over the also-available 4:3 one because the current
  single-`heroImage`-field schema serves both the 4:3 index card and the
  16:9 detail hero from one asset, and a wide source cropped narrower by
  CSS preserves the manifest's deliberate top-biased framing better than
  the reverse (see the new `public/images/story-worlds/savannah-seven/
README.md`). Gallery reuses the full-cast photos already in `public/
images/characters/full-cast/` — no new copying. Tagline/shortDescription
  reuse the exact line already approved and live on `/free30`
  ("Stories inspired by Zulu the Zebra and the Savannah Seven."); synopsis
  is two short, factual sentences (cast roll-call + "in development") —
  no invented plot/lore/marketing claims. River Rangers/Firefly Hollow/
  Ocean World were deliberately left unstubbed — no repo content/assets
  exist for them yet, so the existing honest empty-list/404 behavior
  covers "coming soon" without fabricating placeholder entries.
- Found and fixed a real gap while implementing: the reusable detail
  template never rendered `characterRoster` at all (only the campaign
  platform's `/start/[storyWorld]/[campaign]` route read that field) —
  "characters" was one of the fields explicitly required to be exposable.
  Added one generic "Meet the cast" section (`story-worlds/[slug]/
page.tsx` + matching `page.module.css`, styled consistently with the
  existing gallery section and the homepage's own cast-grid convention)
  driven entirely by `storyWorld.characterRoster` — benefits every future
  Story World, not Savannah-specific. Also added `characterRoster` to
  `getStoryWorldBySlug`'s GROQ projection so a real future Sanity
  document populates the same section identically, not just the seed
  fallback.
- Verified: lint/typecheck/format clean; production-parity build
  (`USE_MOCK_CONTENT=false`) went from 24 to 25 routes
  (`/story-worlds/savannah-seven` now statically generated); `next
start` + curl confirmed the index lists exactly one card (Savannah),
  the detail page renders hero/badges/tagline/synopsis/gallery/all 8
  character portraits+names, `/story-worlds/{river-rangers,firefly-
hollow,ocean-world}` all honestly 404 (not fabricated), and every
  previously-verified route/behaviour (`/`, `/free30`, `/shop`, `/cart`,
  `/contact`, `/leadership`, `/news`, `/checkout/cancelled`,
  `/campaign-unavailable`, the Shopify nav link, no cart icon) is
  unchanged.
- Not touched: `mockContent.ts`'s fictional fixtures, `devRecords.ts`
  (River Rangers' campaign-platform fixture), the campaign platform,
  `/free30`, Shopify integration, Stripe/legacy shop code, Vercel
  config. Not deployed — local implementation only, per instruction;
  stopped for review before any deploy.

## 2026-08-21 — WP9: Shopify merch integration, Phase 1 (nav link only)

- Task: resume the website build following the owner's Shopify audit
  approval — a real Shopify store now exists (Shopify Payments active,
  GBP payouts enabled, first test product created). Scope was
  deliberately narrow: point the primary "Shop" nav link at the Shopify
  storefront, nothing else. No Storefront API/headless work, no Shopify
  product/inventory changes, no legacy code deletion.
- Reinspected the repo first: found `main` (local) 8 commits ahead of
  `origin/main` (unpushed), and the actually-checked-out
  `backup/platform-phase-0-5-2026-08-20` branch one checkpoint commit
  ahead of local `main` and already in sync with its own origin — flagged
  to the owner as an observation, not resolved here (out of this
  session's scope). Did this session's work on a new branch off that
  branch (`feature/shopify-storefront-nav-link`) rather than touching
  either `main` or the backup branch.
- Added `lib/shop.ts` (`NEXT_PUBLIC_SHOP_URL`/`isShopConfigured`) as the
  one isolated config point — swapping the `myshopify.com` URL for a
  branded domain later (`shop.moraltree.media`) needs only an env var
  change. `siteDefaults.ts`'s `DEFAULT_PRIMARY_NAV` now renders "Shop" as
  an external link to that URL, in its existing nav position, and omits
  it entirely (rather than falling back to the legacy internal `/shop`)
  when the var is unset — same honest inert-until-configured contract
  every other integration here already uses. `Header.tsx`'s external-link
  branch already opens in a new tab and is the same markup for desktop
  and mobile (CSS-only breakpoint), so no separate mobile handling was
  needed.
- Removed the Header's cart icon/badge (`useCart` import and the
  `/cart` link) per explicit instruction — Shopify owns the cart in this
  phase, and a badge backed by the now-unlinked local `lib/cart.ts` would
  be a fake count. `lib/cart.ts` itself, `CartView`, WP7's Sanity
  `product`/`order` schemas, `/shop`, `/shop/[slug]`, `/cart`,
  `/checkout/*`, and the Stripe webhook are all untouched — left dormant,
  not deleted, per instruction.
- Did not touch `campaign.offer.stripePriceId` or any campaign/attribution
  Stripe usage (a separate content-subscription feature, unrelated to
  merch) or the `/free30`/`/start/[storyWorld]/[campaign]`/Phase 0–5
  architecture.
- `NEXT_PUBLIC_SHOP_URL` documented in `.env.example`, left unset (no real
  storefront URL was available this session) — "Shop" is currently
  omitted from live nav until the owner sets it.
- Verified: lint/typecheck/format clean; production-parity build; `next
start` + curl confirmed every other route (`/`, `/free30`, `/shop`
  directly, corporate pages) unchanged, "Shop" absent from rendered nav
  with the var unset, and present as an external `target="_blank"` link
  to a placeholder URL with it set (temporarily, for verification only —
  reverted before committing). See the owner-facing report for the exact
  file list and rendered-nav evidence.
- Not done, per explicit instruction: legacy WP7/Stripe cleanup,
  Storefront API/headless work, any Shopify-side product/inventory
  change, a branded `shop.moraltree.media` domain, pushing/merging this
  branch anywhere.

## 2026-08-20 (session 7) — Homepage mobile polish: Hero heading + section gaps

- Task: owner's mobile (~390px) visual review of the corporate homepage
  — approved overall, two targeted CSS-only polish requests: shrink the
  Hero heading ~10-15% and slightly tighten the vertical gap between
  major sections, mobile only, no other changes.
- `Hero.module.css` `.heading`: mobile-only `font-size` changed to
  `clamp(2.1875rem, 1.6625rem + 2.625vw, 3.5rem)` — the existing
  `--text-4xl` clamp's own three terms each scaled by 0.875, a uniform
  12.5% reduction (mid-point of the requested 10-15%) at every width the
  clamp is fluid at, not a single eyeballed number. Restored to
  `var(--text-4xl)` unchanged at `min-width: 40rem`.
- `home.module.css` `.section`: `padding-block` changed from
  `var(--space-8)` to `var(--space-7)` (one existing step down the
  spacing scale, no new value) on mobile, restored to `var(--space-8)`
  at `min-width: 40rem`.
- Both changes scoped to the two files/rules named above only — CTA
  sizing (`Button-module`'s `lg` class unchanged), imagery, copy,
  `/free30`'s enlarged brand mark, and every other component/page
  confirmed untouched by direct inspection of the compiled CSS/HTML, not
  assumed. Production-parity build still 23 routes.
- Not deployed to production — updated NON-PRODUCTION preview only.

## 2026-08-20 (session 6) — `/free30` brand mark: increased prominence

- Task: owner asked for the Moral Tree brand mark to be more prominent —
  +60-80% on desktop/tablet, an "appropriate" (smaller) increase on
  mobile to protect the above-the-fold layout, more vertical breathing
  room, still centred, same artwork, same palette.
- `.brandTreeIcon`: 3rem → 4.5rem on mobile (+50%), → 5.25rem from
  tablet up (+75%, one `min-width: 40rem` breakpoint covers both tablet
  and desktop since the brief asked for the same increase on both).
  `.brandBar` padding-block: `--space-4` → `--space-5` (mobile) /
  `--space-6` (tablet+) for breathing room around the bigger mark.
  `.brandMark` wordmark bumped `text-sm` → `text-md` and
  `.brandLockup`'s gap `space-3` → `space-4` so the lockup still reads
  as one balanced mark rather than an oversized icon next to unchanged
  tiny text. Same image file, no artwork touched; `.brandBarInner`
  (`justify-content: center`) untouched, so it's still centred.
- Verified: lint/typecheck/format clean; clean rebuild confirmed via
  direct CSS inspection that both breakpoints compiled exactly as
  written (4.5rem base / 5.25rem at `min-width: 40rem`, padding-block
  `space-5`/`space-6`) and that nothing else on the page changed (offer
  copy, all 8 hero cluster images, heading hierarchy all re-confirmed
  present/unchanged). Production-parity build still 23 routes.
- Honest limitation, not silently skipped: no headless-browser tool is
  available in this environment, so "recheck at desktop/tablet/430/390"
  was done by computing the resulting brand-bar height at each
  breakpoint from the compiled CSS (padding + icon height) and estimating
  its effect on the rest of the hero's stacked height, not by an actual
  rendered screenshot. The mobile increase (+40px of total added height:
  24px icon + 16px padding) is modest in absolute terms and was sized
  specifically to stay conservative for that reason; the owner's own
  visual check on a real device is the actual confirmation this method
  can't fully replace.
- Not deployed to production — updated NON-PRODUCTION preview only.

## 2026-08-20 (session 5) — `/free30` hero: canon-scale character cluster

- Task: owner feedback on session 4's branding pass — approved, but the
  two hero side images (both full-cast group photos) read as "two
  slightly different versions of the same cast" rather than one
  deliberate composition, and the left photo had a real canon violation:
  Zala (a giraffe) read about the same size as Nara, and Mango read too
  large — flagged specifically, not a general "looks off."
- Checked the finding against the master asset library's own audit
  trail (`14-batch2-corrected/AUDIT-NOTES.md`) rather than assuming:
  confirmed the owner-approved canonical scale table (Zala 1.90× Zulu,
  down to Sid 0.25×) and that the specific left photo used
  (`full-cast-01-group-portrait.png`) was flagged "scale unverifiable"
  (a stacked headshot pose that hides the giraffe's actual height) —
  consistent with the owner's observation, not contradicted by it.
- Rather than searching for a single replacement group photo (none in
  the library both matches the canonical scale for Zala/Nara/Mango _and_
  shares a background/lighting treatment with the other side — checked
  and ruled out), added `relativeScale` to `lib/characters.ts` (the real
  approved canon figures, sourced directly from the audit trail) and
  built a new `HeroCastCluster` component: each hero flank is now one
  canonically-larger "anchor" character (full standing-body pose) above
  three smaller "companion" characters — all built from the individual
  approved character portraits already used everywhere else on the
  site, not a group photo at all. This guarantees the scale hierarchy is
  actually correct (sized in code from the canonical figures) rather
  than dependent on any one photo's composition, and the two flanks
  automatically read as one composition because every individual
  character portrait already shares the same studio background/
  lighting (same generation pipeline, confirmed by inspection).
- Split all 8 characters once across the two flanks (no duplicates):
  left anchored by Zala, right by Kofi (the two largest); Nara and Mango
  — the two characters specifically flagged — land in different small
  slots on opposite sides, nowhere near each other. `object-fit: contain`
  throughout (never crop a character, same rule the corporate homepage
  Hero already follows for Zulu).
- Verified: lint/typecheck/format clean; clean rebuild (cleared `.next`
  first) confirmed via direct HTML/CSS inspection that all 8 individual
  character images render exactly once each with correct per-character
  alt text, Zala/Kofi use the full standing pose and the other six a
  smaller companion pose, no character is cropped
  (`object-fit: contain` compiled once, no stale duplicates), and the
  desktop hero grid/companion-row sizes were widened to actually fit
  three companions across without overflow (checked the arithmetic, not
  assumed). Cast section (a different, untouched full-cast photo),
  offer copy, typography, brand mark, and palette all confirmed
  unchanged. Production-parity build still 23 routes.
- Not deployed to production — updated NON-PRODUCTION preview only.

## 2026-08-20 (session 4) — `/free30` branding: headline serif + tree mark

- Task: owner feedback on session 3's lighter/image-led revision —
  structure and offer copy approved, two branding refinements only: (1)
  the H1 typeface read as generic corporate sans, wanted something
  warmer/more distinctive/premium for a children's storytelling brand
  (not a nursery-playful font); (2) the brand bar was text-only ("Moral
  Tree Media") with no actual tree symbol, so a QR visitor couldn't tell
  this was Moral Tree Media at a glance.
- Headline: added Fraunces (`next/font/google`, loaded directly in
  `CampaignLanding.tsx`, scoped via a `--font-campaign-headline` CSS
  variable to `.kicker` only — not a root-layout/site-wide font change).
  Picked specifically for its soft, warm optical-size design over a
  stiffer editorial serif (Playfair) or an actually-playful nursery
  face — reads as premium-storybook, not corporate or cartoonish. Body
  copy, tagline, and the signup form stay the site's existing Geist
  Sans, per the brief.
- Brand mark: found and used an existing, already-approved, already-
  generated standalone Moral Tree illustration (`~/mtm-assets/.../
11-moral-tree/moral-tree-hero-06-standalone-vertical-crop.png` — one
  of six ✅ "DONE" images per the master library's own manifest,
  distinct from the still-deferred "logo lockup" generation item) —
  copied into `public/images/brand/moral-tree-mark.png`, used as a small
  (3rem) circular icon paired with the existing text wordmark in the
  brand bar. No new artwork generated; composed the lockup from
  real HTML/CSS (icon + live text), not a flattened logo image.
- Verified: lint/typecheck/format clean; clean rebuild (cleared `.next`
  first, after session 3's stale-cache lesson) confirmed via direct HTML/
  CSS inspection that `@font-face` for Fraunces compiled, `--font-
campaign-headline` is declared and consumed by `.kicker`, the brand
  mark image renders, and the "30 Nights Free Trial" headline/heading
  hierarchy are otherwise unchanged (no structural changes, per the
  brief). Production-parity build still 23 routes.
- Not done (explicitly deferred by the owner to a later pass, not
  skipped): reworking the two hero side images so they read as one
  deliberately composed pairing rather than two similar cast shots.
- Not deployed to production — updated NON-PRODUCTION preview only.

## 2026-08-20 (session 3) — `/free30` visual revision: light, image-led

- Task: owner feedback on session 2's `/free30` — too dark, read as "a
  generic dark signup page" not a QR-campaign page, hero too text-only,
  cast section too weak, and one factual copy error ("Narrated by Zulu
  and his circle of friends" implies Zulu narrates every story, which
  isn't true — stories are independently narrated).
- Headline/CTA copy changed per the owner's exact wording: "30 Nights
  Free Trial" (was "30 Free Bedtime Stories"), tagline "Make bedtime the
  perfect end to their day.", CTA "START TONIGHT — FREE FOR 30 NIGHTS"
  (was "...30 DAYS"), reassurance "No credit card today. Cancel
  anytime." Cast copy corrected to "Stories inspired by Zulu the Zebra
  and the Savannah Seven" / "Meet the characters children will love
  returning to each night — each story independently narrated" — no
  narration claim.
- Entire page relit: removed every dark cocoa/espresso section (hero,
  finalCta, brandBar, footer) in favour of the same light cream/ivory/
  brand-100 tokens the corporate site already uses — no new colours.
  This also made the earlier dark-background contrast workaround
  unnecessary (kept the signup card anyway, for the "premium floating
  card" look, not because contrast now requires it).
- Hero redesigned image-led: three already-approved full-cast group
  images (`~/mtm-assets/.../15-approved/` — the master library's own
  "website-use ready" subset, not newly generated) copied into
  `public/images/characters/full-cast/` and manifested in a new
  `lib/characterGroups.ts` (mirrors `lib/characters.ts`'s pattern).
  Hero is now a CSS Grid with named areas: two group-photo cards flank
  the signup content on desktop (≥64rem), stack as a 2-up row above the
  content on mobile/tablet. Cast section replaced three tiny circular
  headshots with one large "storytime circle" group photo (all 8
  characters gathered around a storybook — a strong thematic fit) plus
  a plain-text line naming all eight for balanced representation,
  without competing with the photo.
- Verified: lint/typecheck/format clean; a stale-cache false alarm
  (duplicate old+new CSS rules for the same class after several builds
  without clearing `.next`) was caught and ruled out with a clean
  rebuild, not shipped; clean production-parity build still 23 routes;
  `next start` + curl confirmed every requested copy string present
  exactly, the old inaccurate narration line is gone (0 matches), all
  three group images render, and the browser tab title (missed in the
  first pass, then fixed) now matches the new headline.
- Not deployed to production — updated NON-PRODUCTION preview only.

## 2026-08-20 (session 2) — Corporate homepage refinements + `/free30` (WP8)

- Task: two objectives from the owner — (A) final homepage refinements
  (mission statement in the Hero, mobile-only swipeable cast rail,
  Publishing/Audiobooks/Animation copy that connects to the Story
  World/cast) and (B) a new, visually/functionally separate QR-campaign
  landing page at `/free30` built for one goal (free-trial signup
  conversion), with the architecture ready to reuse for future variants
  (`/blackpool`, `/pampers`, `/chester-zoo`). Full detail:
  `logs/website-update/20260820-092504-corporate-refinements-and-free30-report.md`.
- (A): `Hero` got a new optional `mission` prop (every other caller
  unaffected); homepage's "Meet the cast" mobile layout changed from a
  4-row stacked grid to a native `scroll-snap` swipe rail below 40rem,
  tablet/desktop grid untouched; the three medium cards now name the
  cast instead of describing generic services, with one copy fix so the
  Story World teaser stopped contradicting the section beneath it.
- (B): New `/free30` route + a reusable `CampaignLanding` pattern
  component (hero/benefits/trust/cast-intro/repeated-CTA sections, all
  copy matching the brief verbatim, no invented claims). No corporate
  nav on this route via a new `CorporateChromeGate` — a client-side
  `usePathname()` gate around server-rendered `Header`/`Footer`,
  deliberately chosen over both a ~15-folder route-group restructure and
  a `headers()`-based root-layout check (the latter would have forced
  the _entire_ site into dynamic rendering — verified with a real build
  that only `/free30` itself changed rendering mode, everything else
  identical). Signup Server Action reuses ContactForm's exact
  honeypot/rate-limit/inert-until-configured contract and notifies a
  human by email once configured — it deliberately does **not**
  provision an actual trial (no account/delivery system exists in this
  codebase; flagged as the genuine unresolved dependency, not silently
  invented). `campaign`/`source` route through to the Server Action as
  hidden fields for future analytics.
- Caught two real issues via direct verification rather than assumption:
  `FormField`'s inline error text (`--color-danger`) measured 1.7–2.3:1
  against the new dark hero background (badly failing WCAG) — fixed by
  wrapping the signup field in a light card so it always sits on an
  already-audited surface; and a doubled "Moral Tree Media" in the
  `/free30` browser tab title from stacking a manual suffix on top of
  the root layout's own title template.
- Verified: lint/typecheck/format clean throughout; production-parity
  build (`USE_MOCK_CONTENT=false`) went from 22 to 23 routes with every
  prior route's rendering mode unchanged; `next start` + curl confirmed
  `/free30` has zero corporate chrome while seven other existing routes
  (home, leadership, shop, cart, contact, news, story-worlds,
  checkout/cancelled) still render Header/Footer normally; compiled CSS
  fetched and checked directly for the mobile-rail and dark-hero rules
  at their exact breakpoints. No headless-browser tool is available in
  this environment — responsive behaviour was verified via the compiled
  CSS's own breakpoint values rather than a screenshot; flagged as a
  real verification gap, not silently skipped.
- Not built: `/blackpool`/`/pampers`/`/chester-zoo` (named "later
  variants" in the brief — architecture is ready, routes aren't), any
  analytics vendor (external-service decision, out of scope), or real
  trial provisioning (needs a product decision first — see CLAUDE.md's
  "Guidance for future sessions").
- Not deployed to production — a NON-PRODUCTION Vercel preview was
  created instead per the brief; rollback tag
  `pre-wp8-campaign-funnel-20260820-092504` precedes this session's
  commit on `main`.

## 2026-08-20 — Homepage "Meet the cast": wired up the unused ensemble helper

- Task: resume the website update plan from the current state (brown/cream
  palette + character manifest already live from the 08-18 session),
  audit for anything still incomplete, and continue non-destructively.
  Full detail: `logs/website-update/20260820-082714-phase1-cast-balance-report.md`.
- Found `lib/characters.ts#getEnsembleCharacters()` — written the prior
  session specifically so some section could balance representation
  across Zala/Nara/Mango/Lulu/Sid/Rocky/Kofi without defaulting back to
  Zulu — had no caller anywhere. Added a "Meet the cast" section to the
  homepage null-state (between the Story World teaser and the mediums
  grid): all seven ensemble characters, equal-sized circular portraits
  (`close-up-headshot` pose), canonical name only, no invented
  species/personality/backstory. Zulu stays the Hero image only, not
  repeated in the new grid.
- Fixed one copy inconsistency this created: the Story World teaser said
  "Character, setting, and synopsis details are still in development" —
  no longer true once named characters appear lower on the same page.
  Narrowed to "Setting and synopsis details..." (still un-revealed) and
  pointed readers at the new section. Setting/plot/title stay
  un-announced, matching the prior session's deliberate "Coming soon"
  framing.
- Audited the rest of the site for other placeholder/inconsistency
  candidates first (palette, other listing pages, remaining
  `/placeholder.png` uses) — palette is clean and token-only, and every
  other rule-3 listing page (Leadership/Story Worlds/Shop/News) renders
  real Sanity-backed data with its own legitimate empty state, not a
  place to drop in decorative character art. No other changes made.
- Verified: lint/typecheck/format clean; two production builds
  (`USE_MOCK_CONTENT` true and false, the latter matching Vercel's actual
  config — 22 routes, same count as before); `next start` + curl
  confirmed all 7 ensemble images render exactly once each, Zulu's hero
  image isn't duplicated, alt text is correct per character, and heading
  order is unaffected. `backend/`/`mtm-backend.service` confirmed
  untouched and active throughout.
- Not deployed — per this session's brief, deploys stay a deliberate,
  separate, explicitly-requested step; left committed on `main` for the
  owner to review before shipping.

## 2026-08-14 (session 2) — WP7: shop / e-commerce built from scratch

- Task: audit whether MTM's shop/e-commerce capability existed anywhere
  (this repo, or elsewhere on the linked Vercel account) across twelve
  specific criteria (catalogue, cart, Stripe checkout, subscriptions,
  success/cancel flows, confirmation emails, order recording, mobile
  responsiveness, end-to-end test purchase, refunds, tax/VAT, nav
  wiring). Found nothing — no shop schema, routes, cart, or Stripe
  integration anywhere; the only other thing on the Vercel account was an
  unrelated project ("zulu-the-zebra"/"The Moral Tree" audio app),
  reported transparently rather than assumed irrelevant. Owner chose to
  build it from scratch in this repo, explicit approval required before
  any live financial transaction or external account change (Stripe
  account creation is exactly that — held, like DNS).
- Built WP7 end-to-end, code-complete, inert until a real Stripe account
  exists (same "honest not-set-up-yet" contract WP4's ContactForm
  established): Sanity `product`/`order` document types (`product` never
  stores a price — `stripePriceId` is the sole link to Stripe, avoiding
  price drift; `order` is written exclusively by the webhook); `/shop`
  (listing rule) + `/shop/[slug]` (content-lookup rule, real 404);
  `lib/cart.ts` (localStorage cart via `useSyncExternalStore`, the same
  pattern proven for `ConsentBanner`/`lib/consent.ts` — display-only by
  design); `app/checkout/actions.ts`'s `createCheckoutSession` Server
  Action (charge amount always comes from Stripe's own stored Price,
  never a client-supplied one; every `stripePriceId` cross-checked
  against the active product catalogue); `/checkout/success` (live
  Session lookup, degrades to a generic confirmation if it fails) and
  `/checkout/cancelled`; `app/api/stripe/webhook/route.ts` (records
  orders on `checkout.session.completed`, marks them
  cancelled/refunded on `customer.subscription.deleted`/
  `charge.refunded`, sends a best-effort confirmation email via a new
  `lib/email.ts` extracted from ContactForm's existing inline pattern).
  "Shop" added to primary nav and `sitemap.ts`'s `ALWAYS_AVAILABLE`.
- One architectural decision worth remembering: `formatPrice` lives in
  its own `lib/format.ts`, not `lib/stripe.ts`, specifically so the
  client-side cart/checkout UI can format prices without pulling the
  `stripe` SDK itself into the browser bundle.
- One risk flagged rather than silently assumed: Checkout Session `mode`
  ("subscription" if any cart item is recurring, else "payment") is
  reasoned through against `node_modules/stripe`'s own
  `SessionCreateParams` types, not verified against a live account —
  no Stripe credentials exist in this environment to test against.
  Documented in both the code comment and CLAUDE.md; re-verify the first
  time a real mixed cart actually checks out.
- Verified with full `next build` in three states — `USE_MOCK_CONTENT=true`
  (all shop routes + 3 example products render, prices/subscription
  suffix correct), `USE_MOCK_CONTENT=false` with Sanity/Stripe both
  unconfigured (honest empty/404 states, no crashes), and a live
  `next start` + curl pass confirming the webhook returns 503 when
  unconfigured and the nav/cart badge render correctly. Committed in four
  checkpoints (schema+cart+routes, checkout flow, webhook, docs);
  lint/typecheck/format clean at each. Did not create a Stripe account,
  touch DNS, or process any transaction — all held per the owner's
  explicit instruction.
- Deployed via `vercel --prod` from `apps/web` (the project's existing
  manual-deploy workflow — no GitHub-integration auto-deploy). Confirmed
  live on `https://moraltree.media`: `/shop`, `/cart`,
  `/checkout/cancelled` all 200 with the honest "coming soon"/empty
  states (no Sanity project yet), `/api/stripe/webhook` correctly 503s
  (no Stripe account yet), "Shop" appears in the live nav, and security
  headers (CSP/HSTS/X-Frame-Options) are unchanged.

## 2026-08-14 — Post-deploy audit and documentation accuracy pass

- Task: continue with the next logical work. Re-oriented first by reading
  the actual current repo state in full (git log, CLAUDE.md, DEPLOYMENT.md,
  PROGRESS.md — the prior session's homepage build + first live deploy
  wasn't in this session's own working memory) and independently verifying
  the live site, rather than assuming the log was accurate.
- Verified live: `https://moraltree.media` returns 200 with the documented
  homepage content, correct security headers, and a working
  `sitemap.xml`/`robots.txt`; `moraltreemedia.com` still correctly
  unreachable. CI green on GitHub for both prior commits (checked via the
  Actions API). Confirmed Vercel CLI auth persists on this host
  (`npx vercel whoami` → authenticated) even though the `vercel` binary
  isn't on `PATH` — available if a future change needs `vercel --prod`,
  not used this session since nothing shipped required it.
- Code-reviewed the homepage built last session (hadn't personally
  inspected it before): heading hierarchy, image alt text, icon
  `aria-hidden` usage, and every CSS custom property it references all
  checked out — no ad hoc colours, nothing bypassing the token system or
  the WCAG contrast fix from the 08-09 session.
- Found and fixed real staleness: `CLAUDE.md`'s "Project status" section
  still said connecting Vercel/DNS was outstanding, when the site has in
  fact been live in production since the prior session. Corrected, and
  added an architecture note on Home's route-local
  `home.module.css`/`home-icons.tsx` fallback pattern so a future session
  doesn't have to re-derive why it exists or where the line is (homepage
  only — About/Mission/Publishing/Audiobooks/Animation deliberately still
  404 with no Sanity project; not a gap, and not something this session
  extended without being asked).
- Crawled the _live_ site's links (not just local mock content, which the
  08-09 session had already covered) — About/Mission/Publishing/
  Audiobooks/Animation correctly 404 (expected: real editorial content,
  no Sanity project, honest 404 per null-handling rule 1), everything else 200.
- Pinned down the legacy-domain redirect gap more precisely than before:
  forced a direct connection to Vercel's edge IP with `curl --resolve
moraltreemedia.com:443:<ip>` and confirmed the **TLS handshake itself**
  fails (`SSL_ERROR_SYSCALL`, no cert for that name) — Vercel won't
  terminate TLS for a hostname not added to any project, so the
  already-correct `next.config.ts` redirect literally cannot run for real
  traffic yet, not just "DNS hasn't propagated." Documented in
  `DEPLOYMENT.md`; did not add the domains myself — that's exactly the
  "domain verification" step this repo's tooling deliberately leaves to
  the owner.
- No code behavior changed this session (docs/comments only), so no
  redeploy was needed — committed and pushed to `origin/main` only.
- Verified: lint/typecheck/format/build clean; backend/ untouched
  (checked active before and after).

## 2026-08-10 — Phase 1 production build: premium homepage + first live deploy

- Task: audit the codebase, then build a premium, professional homepage
  (not template-feeling) for parents/commercial partners/investors/
  licensors/brands, no invented corporate claims/figures/partnerships/
  testimonials — clearly-marked placeholders instead — then test, commit,
  and deploy through the existing Vercel workflow. Required nav (Home/
  About/Story Worlds/Publishing/Audiobooks/Animation/News/Contact) was
  already correct in `lib/siteDefaults.ts`; no change needed there.
- Audit found the codebase exactly as CLAUDE.md describes (WP1–6 done,
  code-complete, no real Sanity project) — but found live infrastructure
  CLAUDE.md/DEPLOYMENT.md didn't yet reflect: a Vercel project
  (`moral-tree-media`) already existed, linked (`apps/web/.vercel/`,
  gitignored), with one prior production deployment and `moraltree.media`
  already added as a domain and resolving — from ~22h before this session,
  outside this repo's own git history. Treated that as real existing
  infrastructure to build on, per instructions not to alter DNS/domain/
  email/server config.
- Built the homepage as Home's existing "no page document" null-state
  (still null-handling rule 3 — genuine generic state, not fabricated
  content) rather than a new content source: Hero, mission intro, a Story
  Worlds teaser (explicit "coming soon" + a visibly-badged placeholder
  image, no invented Story World titles), a three-medium section
  (Publishing/Audiobooks/Animation, inline SVG icons — no more blank
  placeholder art than the one image already used), a partnerships CTA
  (prospective language only), a parents/press links section. Entirely
  built from existing design-system components + one route-local module
  (`home.module.css`/`home-icons.tsx`), same convention as
  `status-page.module.css`. The moment a real Sanity `home` page document
  exists, this stops rendering automatically — nothing to tear out by
  hand.
- Verified against real production behaviour specifically — built once
  more with `USE_MOCK_CONTENT` unset (the local `.env.local` already had
  it `true` for visual-review convenience, which would have hidden this
  branch entirely behind mock content instead of exercising it):
  lint/typecheck/build clean, `next start` + curl across changed and
  unchanged routes, heading hierarchy/metadata/robots inspected in the
  rendered HTML.
- Also fixed a small pre-existing gap surfaced this session: `.vercel`
  (created locally by `vercel link`) was gitignored but not
  prettier-ignored, breaking the pre-commit `format:check` the moment that
  directory first existed. Added it to `.prettierignore` alongside the
  existing `.next`/`.sanity` entries.
- Committed and pushed to `origin/main`. Set the one documented-required
  production env var (`NEXT_PUBLIC_SITE_URL=https://moraltree.media`) —
  previously unset. Deployed via `vercel --prod` from `apps/web` (the
  existing project's actual workflow — no GitHub-integration auto-deploy
  is connected, confirmed by timestamps/inspection, so pushing to `main`
  alone does not deploy). Confirmed live: `https://moraltree.media`
  returns 200 with the new homepage, correct security headers, and a
  `sitemap.xml`/`robots.txt` already using the real domain instead of
  `localhost`. Updated `DEPLOYMENT.md`'s stale "not done this session"
  framing to match — domain/env/project setup turned out to already be
  live; only the three legacy-domain redirects (`moraltreemedia.com` +
  both `www.` variants) remain genuinely un-added/unresolving.
- Did not touch: DNS records, email configuration, Vercel domain settings
  beyond what's documented above, `backend/`, or any Sanity schema.
  Store/Login/Subscription/Campaign-landing/Parent-account were left
  unscaffolded — nothing in the routing/nav/schema architecture
  constrains adding them later as ordinary new routes.

## 2026-08-09 (session 2 — continuation)

- Starting point: WP1–WP6 all committed (`46cd57c`..`7ba168e`), every route
  verified against `null` Sanity data (honest 404s/fallbacks, no fabricated
  content).
- Task: add stub/preview content so every route actually renders for visual
  review, run/test the whole app, fix anything broken, then continue with
  the next logical, in-scope work. No new external accounts/credentials
  used or requested (none needed for this phase).
- Built `lib/mockContent.ts` + `USE_MOCK_CONTENT` opt-in flag: every
  `queries.ts` function falls back to stub data only when Sanity is
  unconfigured _and_ the flag is set (never in CI/production by default).
  Layered safety: persistent on-page `PreviewBanner`, forced
  `noindex`/`disallow: /`, empty sitemap — all four gated off one flag.
  All 25 routes (17 base + 2 legal + 3 news + 3 Story World details) now
  render 200 with real layout/content for visual review.
- Testing this surfaced a genuine, previously-undetected bug: every
  route's `generateMetadata` was unconditionally including
  `description`/`robots` keys even when `undefined`, which (per Next's
  metadata-merging rules) silently deleted the root layout's default
  description on _every_ page, real content or not. Fixed site-wide via
  a new `lib/metadata.ts#buildMetadata` helper; verified fixed with mock
  content on and confirmed unchanged (still honest 404s, description now
  present) with it off.
- Verified: lint/typecheck/format/build clean; `sanity build` clean;
  `next start` + curl across every route in both mock-on and mock-off
  states; `mtm-backend.service` checked active throughout.
- Committed as `stub content + mock-mode testing pass` (see git log).
- Follow-up spec-compliance check (WCAG 2.2 AA is an explicit spec
  requirement, and the token palette was designed by eye, not verified):
  computed WCAG relative-luminance contrast ratios for every foreground/
  background colour pairing actually used across the codebase. Found one
  real failure — `--color-text-muted` on `--color-surface-subtle`
  (Hero subheading, Footer links, Badge) at 4.27:1, below the 4.5:1 AA
  floor for normal text. Fixed by darkening `--color-ink-500` from
  `#6b7280` to `#666c78` (4.66:1 there, 5.27:1 against white — margin on
  both, and CtaPanel's opacity-blended text checked separately and found
  already well clear at ~12:1/~8:1). Rebuilt and reconfirmed clean.
- Completed a deferred, well-scoped item flagged since WP3: `RichText`'s
  `resolveInternalLink` had no caller because nothing dereferenced Portable
  Text's `internalLink` annotation in GROQ. Added
  `PORTABLE_TEXT_PROJECTION` (queries.ts) — the same dereferencing
  `LINK_PROJECTION` already did for `link` fields, applied to
  `newsPost.body`/`legalPage.body`/`person.bio` — and refactored
  `resolveLink` to share its internal-ref switch with a new
  `resolveInternalRef`, which all three `RichText` call sites (news post,
  legal page, founder bio) now pass in. Added a mock-content example
  (founder bio linking to a Story World) and confirmed via curl that it
  renders as a real `<a href>`, not styled dead text. Rebuilt with mock
  off and confirmed the route/404 set unchanged.
- Final full-site check: crawled every `<a href>` reachable from all 20
  mock-content pages (nav, footer, in-page CTAs, cards, RichText links —
  17 unique internal URLs) and HEAD-checked each. Zero broken links.
  Backend confirmed active and untouched throughout this entire session
  (`systemctl is-active mtm-backend.service` checked before/after every
  checkpoint); working tree clean at each commit.
- Considered but deliberately held off: wiring `storyWorldGridBlock`
  (still a `PageSections` no-op) into Home. Would need `adaptSections` to
  accept pre-fetched data the way `getFounder()` is merged in for Founder
  — a real, boundable extension of the existing pattern, not a new one —
  but it's a new _feature_ (Home doesn't currently promote Story Worlds)
  rather than a fix to something broken or an already-flagged gap, so it
  stays out per "don't invent unrelated scope." Worth doing if/when asked.

## 2026-08-09 (session 3 — hosting decision)

- Owner decision: Vercel, canonical domain `moraltree.media`,
  `moraltreemedia.com` (+ both `www.` variants) redirect permanently.
- Implemented the redirect at the application level
  (`apps/web/next.config.ts`'s `redirects()`, `has: [{type: "host", ...}]`)
  rather than only as a Vercel dashboard setting, so it's testable locally
  and portable. Verified with `next start` + `curl -H "Host: ..."` for all
  three legacy hosts (each 308s to `https://moraltree.media`, path
  preserved) and confirmed the canonical host and local dev are
  unaffected. Also reconfirmed sitemap.xml/robots.txt correctly emit
  `https://moraltree.media` URLs when `NEXT_PUBLIC_SITE_URL` is set to it.
- Added `DEPLOYMENT.md`: what's done in code (redirects, env-var-driven
  URLs, headers, zero-config Next.js build) versus what needs actual
  Vercel account access and DNS control (creating the project with Root
  Directory `apps/web`, setting env vars, adding domains, DNS, eventual
  HSTS preload submission) — stopped exactly there, as instructed.
- Updated CLAUDE.md (hosting no longer a placeholder assumption),
  `.env.example`, root `README.md`, and replaced `apps/web/README.md`'s
  untouched `create-next-app` boilerplate with real project info — it had
  been missed since WP1. CI's build-step `NEXT_PUBLIC_SITE_URL` now uses
  the real domain instead of `https://example.org`.
- No Vercel account access, domain verification, or DNS changes made or
  attempted — none were required to reach this point, and this session
  doesn't have that access regardless.
- Verified: lint/typecheck/format/build clean in both mock-content-on and
  mock-content-off states; `sanity build` clean; backend/ untouched
  (checked active before and after).

## 2026-08-09 (session 1)

- WP1 Foundation, WP2 Sanity CMS/schemas, WP3 design system, WP4 corporate
  shell/security/consent/contact form, WP5 core corporate pages, WP6 Story
  World portfolio system. All committed and verified (lint/typecheck/
  format/build/`sanity build` clean at each checkpoint).

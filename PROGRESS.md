# Progress log

Concise, dated record of autonomous work sessions on this repo. Full detail
lives in `git log`; current architecture/status lives in `CLAUDE.md`. Newest
entries first.

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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project status

This is the Moral Tree Media (MTM) website, being built to an approved Phase
One specification (corporate pages, capability pages, a Story World
portfolio system, news, contact, legal pages, a shared design system,
WCAG 2.2 AA accessibility, Core Web Vitals performance, and standard
security/privacy controls).

**All seven work packages are functionally complete** (code-wise — see each
WP below), **and the site is live in production**: Vercel project
`moral-tree-media`, canonical domain `https://moraltree.media` (200,
correct security headers, real deployed content) — see `DEPLOYMENT.md` for
exactly what's confirmed live versus what's still pending (the three
legacy-domain redirects have nothing to redirect _from_ yet — no DNS on
those hosts — Sanity, and the contact-form provider vars). Deploys are
manual (`vercel --prod` from `apps/web`) — there is **no GitHub-integration
auto-deploy**, so pushing to `main` alone does not ship a release; that's a
deliberate, already-verified fact about this project's workflow, not a gap
to "fix" by wiring one up unless asked. What's left is not code: a real
Sanity project/credentials, a real Stripe account/credentials (test-mode
first — see WP7 below and "Guidance for future sessions"), real
content/copy/legal text/brand assets/product catalogue, and the three
legacy-domain DNS records. None of that blocks further engineering work —
Home already renders a real (if honestly-placeholder) production homepage
rather than a null-state; the remaining pages still follow the
null-handling rules below until they get the same treatment or real
content lands.

For visual review without a real Sanity project, set `USE_MOCK_CONTENT=true`
(`apps/web/.env.local`) — every route then renders `lib/mockContent.ts`'s
stub content instead of its null-state, behind a persistent on-page banner
and forced `noindex`/`disallow: /`. See "Mock content" under Architecture
notes; this does not change the null-handling contract itself.

Implementation proceeded in work packages:

- **WP1 — Foundation** ✅ Next.js app scaffolded in `apps/web`, tooling
  (ESLint incl. a11y rules, Prettier, TypeScript strict, Husky pre-commit,
  GitHub Actions CI), env var scaffolding.
- **WP2 — Sanity CMS and schemas** ✅ Sanity Studio in `apps/studio`
  (documents: `page`, `storyWorld`, `newsPost`, `person`, `legalPage`,
  `siteSettings`; a `pageBuilder` section system covering every
  design-system pattern in the spec). `apps/web/src/lib/sanity` wires the
  client/queries/image URLs, degrading gracefully to `null` until a real
  project exists (see Architecture notes).
- **WP3 — Design system** ✅ Tokens (`apps/web/src/styles/tokens.css`) +
  base styles (`base.css`), a `ui/` primitive layer (Container, Button,
  Card, Badge, TextField/TextArea, SkipLink, VisuallyHidden), and a `patterns/`
  layer covering every named pattern in the spec (Header, Footer, Hero,
  RichText, CtaPanel, Media, Quote, Timeline, Stats, CardGrid) plus
  `PageSections`, the renderer that dispatches a page's `sections` array to
  the matching pattern component. Demoed end-to-end at `/style-guide`
  (noindex). See Architecture notes for what's deliberately deferred.
- **WP4 — Corporate shell, legal/error routes, global metadata** ✅ Root
  layout (`apps/web/src/app/layout.tsx`) fetches `siteSettings` and renders
  `Header`/`Footer`/`SkipLink`/`ConsentBanner`, falling back to
  `lib/siteDefaults.ts` when unconfigured (see Architecture notes — this is
  a different rule from page-content null-handling). `not-found.tsx`,
  `error.tsx`, `global-error.tsx`; `/legal/[slug]` (real 404 on unknown
  slug); `sitemap.ts`/`robots.ts`; security headers incl. CSP
  (`next.config.ts`); `ContactForm` is real (Server Action, honeypot +
  best-effort rate limiting, optional Turnstile/Resend — inert until their
  env vars are set) and wired into `PageSections`' `formEmbedBlock` case.
- **WP5 — Core corporate pages** ✅ All ten routes exist: `/`, `/about`,
  `/founder`, `/leadership`, `/mission`, `/publishing`, `/audiobooks`,
  `/animation`, `/contact`, `/news` (+ `/news/[slug]`). `lib/pageSections.ts`
  is the Sanity `sections` → `PageSection[]` adapter (see Architecture
  notes). Three different null-handling rules apply depending on the page
  — see "Null-handling rules by page" below; don't assume they're all the
  same. `teamGridBlock`/`newsListBlock` are still `PageSections` no-ops
  (Leadership/News render their person/post lists directly instead, not
  through a pageBuilder block).
- **WP6 — Story World portfolio system** ✅ `/story-worlds` (index, listing
  rule — empty catalogue isn't a 404) and `/story-worlds/[slug]` (the one
  reusable detail template: hero image, status/format badges, synopsis,
  gallery, then `sections` via the same `PageSections`/`adaptSections`
  every other page uses). `storyWorldGridBlock` remains a deliberate
  `PageSections` no-op — real Story World data exists now, but no page
  embeds the block yet (see Architecture notes); that's still the actual
  trigger for wiring it, not "WP6 landing".
- **WP7 — Shop / e-commerce** ✅ Sanity `product` and `order` document
  types (`order` is webhook-written only — nothing in the Studio UI
  creates one). `/shop` (index, listing rule), `/shop/[slug]` (product
  detail, content-lookup rule), `/cart` (noindex), `/checkout/success`,
  `/checkout/cancelled`. `lib/cart.ts` is a localStorage cart
  (`useSyncExternalStore`, same pattern as `ConsentBanner`/`lib/consent.ts`)
  — display-only by design; `app/checkout/actions.ts`'s
  `createCheckoutSession` Server Action is what actually talks to Stripe,
  and only ever sends `stripePriceId`/`quantity` (never a client-supplied
  amount) after cross-checking every `stripePriceId` against the current
  active product catalogue. `app/api/stripe/webhook/route.ts` records
  `order` documents on `checkout.session.completed`, marks orders
  "cancelled"/"refunded" on `customer.subscription.deleted`/
  `charge.refunded`, and sends a best-effort confirmation email. Every
  piece is inert-until-configured (`isStripeConfigured`,
  `isSanityWriteConfigured`) with an honest "not set up yet" message or
  console warning, the same contract `ContactForm` established in WP4 —
  see "Guidance for future sessions" for what going live actually requires.
  No real Stripe account exists yet; nothing here has processed a real
  charge.
- **WP8 — Consumer campaign funnel (partial, `/free30` only)** 🚧 A second,
  deliberately separate visual/functional system for QR-code and
  direct-link traffic, alongside (not replacing) the corporate site.
  `lib/campaignRoutes.ts` is the hand-maintained registry of which routes
  count as "campaign" routes (currently just `/free30`); `CorporateChromeGate`
  (`components/patterns/CorporateChromeGate`) reads it to suppress the
  corporate `Header`/`Footer` on those routes only — a client-side
  `usePathname()` gate around Server-Component-rendered children, chosen
  specifically so it doesn't force any route (campaign or corporate) into
  dynamic/per-request rendering (see its own doc comment for why that
  ruled out reading `headers()`/pathname in the shared root layout).
  `components/patterns/CampaignLanding` is the reusable landing-page
  template (`CampaignLanding.tsx` + `SignupForm.tsx` + `actions.ts` +
  `campaign-icons.tsx`) — `campaign`/`source` route through the page into
  the signup Server Action as hidden fields, so a later analytics
  integration has real per-campaign/per-source data from day one. Light
  cream/ivory/brand-100 palette throughout (no dark sections — an
  earlier dark-hero draft read as "a generic dark signup page," not a
  warm campaign page, per owner feedback). `lib/characterGroups.ts` (a
  `characters.ts`-style manifest for three already-approved full-cast
  group photos, `public/images/characters/full-cast/`, copied from the
  master library's `15-approved/` "website-use ready" subset) now backs
  only the cast section's one photo — the hero's own left/right imagery
  moved away from full-cast photos entirely (see
  `HeroCastCluster.tsx`'s doc comment): none of that manifest's group
  photos both satisfy `lib/characters.ts#relativeScale` (the master
  library's owner-approved canonical scale table — Zala/Kofi read
  clearly largest, Sid smallest — added to the character manifest
  specifically for this) _and_ share a background/lighting treatment
  with each other, so the hero instead composes two "one anchor + three
  smaller companions" clusters directly from the same individual
  approved character portraits used everywhere else on the site, sized
  by tier to match the canonical order. `object-fit: contain` throughout
  the cluster (never crop a character), unlike the cast section's one
  full-cast photo which still uses `cover` (an establishing scene, not a
  solo portrait). The brand bar is a
  proper icon+wordmark lockup, not text-only — `public/images/brand/
moral-tree-mark.png` (also an approved, already-generated asset, see
  its own README) is the actual Moral Tree symbol, not just the words
  "Moral Tree Media". The hero headline (`.kicker` only — body/tagline/
  form stay Geist Sans) uses Fraunces, a warm display serif loaded via
  `next/font/google` directly in `CampaignLanding.tsx` and scoped with a
  CSS variable (`--font-campaign-headline`) rather than added to the
  root layout — deliberately not a site-wide typography change.
  `/free30/page.tsx` is the one route built so far; adding `/blackpool`,
  `/pampers`, or `/chester-zoo` later means a thin `app/<slug>/page.tsx`
  rendering `<CampaignLanding campaign="<slug>" .../>` (optionally with a
  partial `content` override) plus adding `<slug>` to
  `CAMPAIGN_ROUTE_SLUGS` — don't forget the latter, or that route quietly
  keeps the full corporate nav. `robots: {index:false, follow:true}` is a
  deliberate default (not a hard requirement), same carve-out as
  `/cart`/checkout routes sitting outside the three null-handling rules —
  flip it if the owner wants a campaign page discoverable via search too.
  **The signup action does not provision an actual trial** — no customer
  account/audiobook-delivery/CRM system exists anywhere in this codebase.
  It validates, rate-limits, and honeypots exactly like `ContactForm`,
  then (inert-until-configured on `FREE_TRIAL_TO_EMAIL`/
  `CONTACT_FORM_FROM_EMAIL`, same contract as WP4/WP7) emails a human to
  follow up by hand. Building real automated provisioning is the
  genuinely unresolved dependency this WP stopped short of — see
  "Guidance for future sessions."

## Repository structure

```
apps/web/     Next.js 16 (App Router, TypeScript) — the website.
apps/studio/  Sanity Studio — content authoring for apps/web.
backend/      Legacy Express stub. NOT part of the npm workspace.
```

### ⚠️ `backend/` is a live production service — do not touch without a migration plan

`backend/index.js` runs under the `mtm-backend.service` systemd unit on this
host (`WorkingDirectory=/home/stuart/workspace/mtm-platform/backend`,
`Restart=always`). Do not delete, move, rename, or refactor anything under
`backend/`, and do not run installs/builds against it, unless the owner has
explicitly asked for a migration of that service. It predates the Next.js
app and currently only exposes a health-check route — any future need to
retire or replace it (e.g. folding its purpose into Next.js route handlers)
requires an explicit, deliberate cutover, not an incidental cleanup.

## Commands (run from repo root)

| Command                           | Effect                                      |
| --------------------------------- | ------------------------------------------- |
| `npm install`                     | Install all workspace deps (`apps/*`)       |
| `npm run dev` / `dev:studio`      | Next.js / Sanity Studio dev server          |
| `npm run build` / `build:studio`  | Production build of `apps/web` / Studio     |
| `npm run lint`                    | ESLint, all workspaces (a11y rules `error`) |
| `npm run typecheck`               | `tsc --noEmit`, all workspaces              |
| `npm run format` / `format:check` | Prettier, whole repo                        |

Husky runs `lint` + `typecheck` + `format:check` on pre-commit. CI
(`.github/workflows/ci.yml`) runs the same plus a full `apps/web` build. All
of the above intentionally exclude `backend/`.

Env vars: `apps/web/.env.example`, `apps/studio/.env.example`. Copy to
`.env.local`/`.env` locally; never commit real values.

## Architecture notes

- Next.js App Router + TypeScript, no Tailwind — the design system is CSS
  custom-property tokens (`apps/web/src/styles/tokens.css`) + CSS Modules,
  not a utility framework, so components map 1:1 to the spec's named
  patterns and to the Studio's `pageBuilder` block types (see
  `apps/studio/schemaTypes/objects/`). Colours are a placeholder palette
  (documented in tokens.css) — swap `--color-brand-*` when real brand
  assets land, nothing else should need to change. `--color-ink-500`
  (backs `--color-text-muted`) is contrast-tuned, not arbitrary: audited
  every foreground/background pairing actually used in the codebase
  against WCAG AA (4.5:1) after the fact and found the original `#6b7280`
  failed at 4.27:1 against `--color-surface-subtle` (Hero subheading,
  Footer links, Badge) — fixed to `#666c78` (4.66:1 there, 5.27:1 against
  white). Re-run that audit (see PROGRESS.md for the method — relative
  luminance per WCAG's formula, not eyeballing) after any palette change,
  including the eventual real-brand-colour swap.
- `components/ui` = generic primitives (Button, Card, Container, form
  fields). `components/patterns` = one component per pageBuilder block type
  (Hero, RichText, CtaPanel, Media, Quote, Timeline, Stats, CardGrid,
  ContactForm, Header, Footer, ConsentBanner) plus `PageSections`, which
  switches on a section's `_type` to render it. `PageSections`' components
  are deliberately presentational — they take plain resolved props
  (`href: string`, already-built image `src`), not raw Sanity objects.
  `lib/pageSections.ts#adaptSections` is the adapter: queries.ts's
  `SECTIONS_PROJECTION` dereferences each block's links/images in GROQ,
  `adaptSections` then maps each raw `{_type, _key, ...}` entry to its
  typed `PageSection` variant (dropping sub-parts it can't resolve — a
  missing image, an unresolvable link — rather than dropping the whole
  section). Keep `SECTIONS_PROJECTION`, `adaptSections`, and
  `PageSections/types.ts` in sync by hand when a block type's fields
  change; nothing generates one from the others. `lib/links.ts#resolveLink`
  is the narrower version of this same idea for standalone `link` fields
  (site-wide nav, a block's single CTA) and is what `adaptSections` itself
  calls for those.
- Three pageBuilder block types still render `null` in `PageSections` (see
  its switch statement): `teamGridBlock`, `newsListBlock`,
  `storyWorldGridBlock` — all _by design_, not because anything's missing.
  Leadership/News/Story-Worlds-index each query their own data
  (`person`/`newsPost`/`storyWorld`) directly instead, since a page's own
  primary listing isn't something an editor picks per-page. All three
  block types stay available for embedding that _same kind_ of listing on
  some _other_ page instead (e.g. a `storyWorldGridBlock` on Home, or a
  `newsListBlock` on About) — that's the actual trigger for giving one a
  real `PageSections` case, not merely having the underlying data exist.
  Wiring one in means either `adaptSections`/`PageSections` learning to
  fetch data (a real architecture change — see the trade-off this avoids:
  keeping `PageSections` synchronous and purely presentational) or the
  calling route pre-fetching and merging it in, the way Founder merges
  `getFounder()` alongside its `page` document. `formEmbedBlock` is real
  since WP4 (see ContactForm below) precisely because it _didn't_ need
  either — the form has no listing to fetch.
- `RichText` (Portable Text renderer) resolves `internalLink` marks via a
  `resolveInternalLink` prop. `queries.ts`'s `PORTABLE_TEXT_PROJECTION`
  dereferences the annotation's `reference` the same way `LINK_PROJECTION`
  does for `link` fields; `lib/links.ts#resolveInternalRef` turns that into
  a real href (it's the same switch `resolveLink` uses internally — both
  now call one shared function rather than duplicating it). Every
  rich-text consumer (legal pages, news posts, founder bio) passes
  `resolveInternalLink={resolveInternalRef}`. A caller that doesn't (there
  isn't one currently) still degrades to styled-but-non-interactive text
  rather than a broken `<a>` with no `href` — that fallback stays as
  defence in depth, not because anything still needs it. Images inside
  rich text and elsewhere go through `urlFor()` (`lib/sanity/image.ts`),
  which accepts a raw `{_ref}` image object directly — no need to
  dereference `asset->url` in GROQ for that case.
- `ContactForm` (`components/patterns/ContactForm`) is a real,
  progressively-enhanced form: a Server Action (`actions.ts`) does
  server-side validation, a honeypot field, and best-effort in-memory
  per-IP rate limiting (documented as not multi-instance-safe — a real
  deployment needs a shared store like Upstash Redis once a hosting target
  is picked). Cloudflare Turnstile and Resend email delivery are both
  wired but inert until their env vars are set (see the five contact-form
  vars in `apps/web/.env.example`); with those unset, submissions are
  rejected with an honest "not set up yet" message rather than silently
  vanishing or falsely claiming success.
- `next.config.ts`'s CSP uses the no-nonce approach from Next's own docs
  (`script-src`/`style-src` include `'unsafe-inline'`) rather than
  per-request nonces — nonces force every page to render dynamically,
  which trades away the static optimization this mostly-static site needs
  for Core Web Vitals. Revisit only if the project's security requirements
  tighten enough to justify that trade-off.
- `next.config.ts`'s `redirects()` sends `moraltreemedia.com` and both
  `www.` variants to `https://moraltree.media` with a 308, matched on the
  request's `Host` header (`has: [{type: "host", ...}]`) — deliberately an
  application-level redirect rather than a Vercel dashboard setting, so it
  works locally (`next start` + `curl -H "Host: ..."`, no live DNS needed
  to verify it) and isn't tied to Vercel specifically. See `DEPLOYMENT.md`
  for what still needs actual Vercel/DNS access.
- Site-wide chrome (nav/footer/site title in the root layout) falls back to
  `lib/siteDefaults.ts` when `getSiteSettings()` returns `null` — this is
  **not** the same rule as page-content null-handling below; global chrome
  has to work before any content exists, page content doesn't.
- `next.config.ts` already whitelists `cdn.sanity.io` in `images.remotePatterns`
  for when real Sanity images arrive. Local placeholder images
  (`apps/web/public/placeholder.png`) exist for demo/dev use only — an SVG
  was deliberately avoided since `next/image` blocks SVG sources by default
  (XSS risk) and enabling `dangerouslyAllowSVG` isn't worth it for a
  placeholder.
- Next.js 16 generates global `PageProps<'/route'>` / `LayoutProps<'/route'>`
  helper types automatically (via `next dev`/`build`/`typegen`) — use these
  instead of hand-writing `params: Promise<{...}>` on new routes.
- `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` are regenerated by
  `next dev` itself (framework-managed agent guidance) — leave them alone;
  they're intentionally separate from this file.
- **No real Sanity project exists yet.** `apps/web/src/lib/sanity` (client,
  image URL builder, queries) is fully wired but `sanityFetch()` returns
  `null` whenever `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset, which is true in
  every environment right now — this is intentional so the site keeps
  building without live credentials, and it means every WP5 route was
  verified against `null` data (a real `next start` + curl pass — see WP5
  commit message), not just typechecked. Once a project exists: set
  `SANITY_STUDIO_PROJECT_ID`/`_DATASET` in `apps/studio/.env` and the
  matching `NEXT_PUBLIC_SANITY_*` vars in `apps/web/.env.local`.
- **Mock content** (`lib/mockContent.ts`, gated by `USE_MOCK_CONTENT` in
  `lib/sanity/env.ts`) exists purely so every route can be visually
  reviewed without a real Sanity project — it is not a second content
  source to design around. Each `queries.ts` function falls back to it
  only when `sanityFetch()` returns `null` _and_ the flag is on; with the
  flag off (always true in CI/production unless someone deliberately sets
  it), behavior is byte-for-byte what it was before this file existed —
  verified by rebuilding with it unset and confirming the same 404s/
  fallbacks. Mock image _refs_ don't point at real Sanity assets, so
  `urlFor()` (`lib/sanity/image.ts`) special-cases mock mode to always
  resolve to `/placeholder.png` via a tiny mock `ImageUrlChain` rather than
  trying to build a real CDN URL from a fake ref. Safety is layered, not
  single-point: `PreviewBanner` (persistent, non-dismissible) on every
  page, root layout forces `robots: {index:false,follow:false}`,
  `robots.ts` returns a blanket `disallow: /`, and `sitemap.ts` returns
  `[]` — all four keyed off the same flag, so there's no way to have
  mock content rendering without all four also being active.
- **Metadata merging pitfall (found via mock-content testing, fixed
  site-wide):** Next.js treats a key's mere _presence_ in a route's
  `generateMetadata` return value — even set to `undefined` — as that
  route defining the field, which drops the root layout's default instead
  of inheriting it (unlike an _omitted_ key, which does inherit). Every
  route was doing `{ description: seo?.metaDescription }`, which silently
  deleted the site-wide default description on any page without its own
  `seo.metaDescription` — i.e. every page, since no content (real or
  mock) sets `seo` yet. Fixed by routing every route's `generateMetadata`
  through `lib/metadata.ts#buildMetadata`, which omits `description`/
  `robots` entirely when there's no value. Use it for any new route
  rather than building the Metadata object by hand.
- **Null-handling rules by page — three different rules, not one.** Don't
  assume "treat null as an error" applies uniformly:
  1. **Pure editorial content** (About, Founder†, Mission, Publishing,
     Audiobooks, Animation, legal pages, a Story World by slug, a news post
     by slug, **a product by slug**) — a missing document is a real 404
     (`notFound()`). There's no honest non-fabricated fallback for a
     company's About copy, a founder's bio, or a specific product page, so
     don't invent one.
  2. **Site-wide chrome** (root layout's nav/footer/site title) — falls
     back to `lib/siteDefaults.ts`. Global chrome has to work before any
     content exists at all.
  3. **Listing/utility pages** (Leadership's person grid, News' index,
     Story Worlds' index, **Shop's product grid**, Contact's form, Home) —
     render a genuine empty/generic state, not a 404 and not fabricated
     copy. An empty catalogue
     is a normal state; being unreachable (Contact) or 404ing at the
     domain root (Home) would be worse than a plain placeholder. Home's
     "no `page` document" state (`app/page.tsx`, `home.module.css`,
     `home-icons.tsx`) is the fullest example of this rule in practice: a
     real, premium marketing homepage built entirely from hand-authored
     positioning copy and clearly-marked placeholders (a badged "Placeholder
     artwork" image, an explicit "coming soon" Story World teaser — no
     invented titles/figures/partnerships/testimonials), not a bare
     one-liner and not fabricated content. It's route-local (like
     `status-page.module.css` for the error routes), not a shared
     `patterns/` component, because the copy is homepage-specific, not a
     reusable block type. The instant a real Sanity `home` page document
     exists, this whole branch stops rendering in favour of that
     document's own `sections` — nothing to tear out by hand.

  † Founder is 1+3 at once: no `page` doc _and_ no founder `person` doc is
  a 404, but either one alone renders something (see `app/founder/page.tsx`).

  `/cart`, `/checkout/success`, and `/checkout/cancelled` sit outside this
  three-rule framework entirely — they're personal, transient views of a
  browser's own localStorage cart or a single Stripe Checkout Session, not
  shared editorial content, so all three are `noindex` and none of them
  404 (an empty cart, an unrecognised/missing `session_id`, and a plain
  "you weren't charged" message are all just rendered directly rather than
  mapped onto rule 1/2/3). `/free30` (WP8) sits outside it for a different
  reason — it's not Sanity-backed content at all, editorial or otherwise;
  it's a hand-authored, always-on campaign landing page, `noindex` by
  default (a judgement call, not a rule) since it's built for QR/
  direct-link traffic rather than organic search.

- `page` documents use a fixed `pageId` (see the option list in
  `apps/studio/schemaTypes/documents/page.ts` and `PAGE_IDS` in
  `apps/studio/structure.ts` — includes `news`, added in WP5 alongside
  `/news`; a WP2 gap where it was missing from both lists) so
  Home/About/Founder/etc. are pinned singletons in the Studio rather than
  editor-creatable duplicates. `PAGE_ID_PATHS` (`lib/links.ts`) maps each
  `pageId` to its route and must stay in sync with the App Router folder
  structure by hand — adding a page route means updating both.
  `storyWorld`, `newsPost`, `person`, `legalPage` are open document lists.
- `sitemap.ts` only lists a `pageId`'s route once a real `page` document
  exists for it (via `getExistingPageIds()`), except the always-available
  ones (`ALWAYS_AVAILABLE`: home/leadership/contact/news/story-worlds/shop,
  i.e. every rule-3 listing page above) — otherwise it would point search
  engines at pages that currently 404. It also lists real news-post,
  Story-World, and product slugs directly (not gated on their `page` doc).
  Update `ALWAYS_AVAILABLE` if a page's null-handling rule changes.
- **Shop (WP7) price-drift avoidance:** the Sanity `product` document never
  stores a price — `stripePriceId` is the sole link to Stripe, and
  `lib/stripe.ts#getProductPrice` fetches the live Stripe Price at render
  time (with a `mockContent.ts#mockProductPrices` fallback in mock mode).
  Don't add a price/amount field to the `product` schema; it would drift
  from Stripe's own value the first time either side is edited alone.
- **Shop (WP7) cart is display-only, not authoritative:** `lib/cart.ts`'s
  localStorage cart stores `unitAmount`/`currency` purely for showing a
  subtotal in the UI. `app/checkout/actions.ts#createCheckoutSession` is
  the only thing that talks to Stripe, and it only ever sends
  `stripePriceId`/`quantity` — Stripe determines the actual charge from
  its own stored Price, never from a client-supplied amount — and
  additionally cross-checks every `stripePriceId` against the current
  active product catalogue (`getProducts()`) before use, so a tampered
  cart can at worst reference a real active product in this Stripe
  account, never an arbitrary amount or a removed/inactive one.
- **Shop (WP7) checkout mode:** `createCheckoutSession` uses
  `mode: "subscription"` if any cart item is a recurring price, else
  `mode: "payment"` — Stripe allows a one-time Price alongside recurring
  Price(s) in subscription mode but rejects the reverse. This was reasoned
  through against `node_modules/stripe`'s `SessionCreateParams` types, not
  verified against a live Stripe account (none exists yet) — re-verify the
  first time a real mixed one-time+subscription cart actually checks out.
- **Shop (WP7) webhook** (`app/api/stripe/webhook/route.ts`) is the only
  place besides the Studio itself that writes to Sanity — via
  `lib/sanity/writeClient.ts#sanityWriteClient`, `null` unless
  `SANITY_API_WRITE_TOKEN` is set (separate from, and stricter than,
  `isSanityConfigured`). It records an `order` on
  `checkout.session.completed`, and updates an existing order's `status`
  to `"cancelled"`/`"refunded"` on `customer.subscription.deleted`/
  `charge.refunded` (the latter looks the Checkout Session back up from
  Stripe via the charge's `payment_intent`, since orders are keyed on
  session ID — there's no `paymentIntentId` field on the schema, and
  adding one just for this lookup wasn't worth it). A handler failure is
  logged, not rethrown, so a bug doesn't make Stripe retry the same event
  forever; Stripe's own Dashboard and (once `SANITY_API_WRITE_TOKEN` is
  set) Sanity's Orders list are the two places to actually check order
  history — this webhook is not itself a system of record.

## Guidance for future sessions

- Keep this file's work-package checklist current as WPs land.
- Do not touch `backend/` — see above.
- **`/free30`'s signup does not grant an actual free trial** (see WP8) —
  it notifies a human by email, nothing more. Making "free for 30 nights"
  real needs a genuine decision + build: some kind of customer
  account/access-grant system and a way to actually deliver audiobook
  content (a member area? emailed links? a third-party platform?). That's
  a real product/architecture decision for the owner, not something to
  infer and build unprompted. Don't add fake "trial activated" UI states
  before that system exists.
- Adding a new campaign/QR landing route (`/blackpool`, `/pampers`,
  `/chester-zoo` are the named examples) means: a thin
  `app/<slug>/page.tsx` rendering `<CampaignLanding campaign="<slug>" />`
  (see WP8), **and** adding `<slug>` to `lib/campaignRoutes.ts`'s
  `CAMPAIGN_ROUTE_SLUGS` — skipping the second step leaves the full
  corporate nav showing on what's supposed to be a stripped-down
  conversion page.
- **Hosting is now a firm decision, not a placeholder**: Vercel, canonical
  domain `moraltree.media` — see `DEPLOYMENT.md` for exactly what's done
  in code versus what still needs Vercel account access/DNS. Don't
  re-litigate this or treat it as still-open; WP1's original "Vercel-
  shaped hosting" assumption is now confirmed, not a guess to revisit.
  Self-built cookie consent (`ConsentBanner`) and Cloudflare Turnstile for
  form spam-protection (`ContactForm`) are also actually implemented, not
  just planned — swapping either for a different vendor means replacing
  those specific components/env vars, not starting from scratch.
- The contact form's rate limiting is in-memory and single-instance
  only — fine for one Vercel serverless function instance, not guaranteed
  correct across concurrent instances under real traffic. Swap in a shared
  store (Upstash Redis, Vercel KV, etc.) when that becomes a real problem,
  not speculatively before there's traffic to warrant it.
- Adding a Sanity `pageBuilder` block type requires touching three places:
  `apps/studio/schemaTypes/objects/<name>.ts`, its registration in
  `apps/studio/schemaTypes/objects/pageBuilder.ts` and
  `apps/studio/schemaTypes/index.ts`, and (from WP3 onward) a matching
  renderer case in the page-builder component in `apps/web`.
- **No real Stripe account exists yet (WP7)** — same status as Sanity.
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` unset means the shop browses
  fine but checkout/webhook both degrade honestly (see WP7 above). Setting
  up a real account, creating live Products/Prices in the Stripe
  Dashboard, and configuring the webhook endpoint
  (`https://moraltree.media/api/stripe/webhook`) are external-account
  steps for the owner to do, same category as DNS/domain changes — don't
  do this without being asked, and **use test-mode keys** even once asked,
  unless the owner explicitly says to go live. Once product Prices exist
  in Stripe, create matching `product` documents in the Studio with each
  one's `stripePriceId` — there's no sync/import tooling for this, it's a
  manual one-to-one link by design (see the price-drift note above).
- The shop's rate limiting (`app/checkout/actions.ts`) has the identical
  in-memory/single-instance caveat as the contact form's — same fix
  (shared store) applies to both if/when it becomes a real problem, not
  two separate efforts.

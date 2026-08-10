# Progress log

Concise, dated record of autonomous work sessions on this repo. Full detail
lives in `git log`; current architecture/status lives in `CLAUDE.md`. Newest
entries first.

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

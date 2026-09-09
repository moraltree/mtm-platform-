# Corporate homepage refinements + `/free30` campaign landing — report

Completed: 2026-08-20 (server-local time)

## Starting state

- Branch `main`, working tree clean, HEAD `dc16b18` ("Meet the cast"
  ensemble section — the previous session in this same conversation).
- Rollback point: annotated tag `pre-wp8-campaign-funnel-20260820-092504`
  on `dc16b18` — `git checkout` (or `git reset --hard` from `main`) it to
  fully revert this session's work.

## A. Corporate homepage refinements

`Hero.tsx`/`Hero.module.css`, `app/page.tsx`, `app/home.module.css`:

- Added an optional `mission` prop to the shared `Hero` pattern (every
  other caller — CMS `heroBlock`s via PageSections, the style guide —
  omits it and is unaffected). Homepage now passes the requested mission
  line directly beneath the headline: sized between the H1 and the
  subheading, semibold, brand-cocoa colour — visually important but
  subordinate to the headline, not a second heading.
- "Meet the cast": tablet (≥40rem, 4 cols) and desktop (≥64rem, 7 cols)
  grid layouts are untouched. Mobile (below 40rem) changed from a
  2-column grid (7 items → 4 wrapped rows, the "long stacked" layout) to
  a horizontally swipeable rail — native CSS `scroll-snap`, no JS —
  with a small "Swipe to meet everyone →" hint (hidden ≥40rem,
  `aria-hidden` since the list itself is already fully reachable by
  scrolling/reading order for assistive tech).
- Publishing/Audiobooks/Animation card copy rewritten to name the cast
  ("Follow Zulu and his circle of friends...", "Hear their story...",
  "Watch their world...") instead of describing three generic services —
  ties back to the "Meet the cast" section just above it without
  revealing the still-unannounced setting/synopsis/title. Fixed one
  resulting inconsistency: the Story World teaser previously said
  "Character, setting, and synopsis details are still in development",
  contradicted by the section 200px below it now naming characters —
  narrowed to "Setting and synopsis..." (unchanged: title/plot stay
  unrevealed).
- Added one small decorative touch tying the two together further: a
  circular Zulu "stamp" (already-approved `playful-tilt` pose, `alt=""`)
  inline with the "How our stories reach families" heading — a repeated
  brand mark, not a new per-medium character assignment (nothing in this
  repo's canon assigns specific characters to specific mediums).
- No layout structure changed beyond the above; no new colours — every
  new/changed rule consumes existing `tokens.css` custom properties.

## B. `/free30` campaign landing page

New: `lib/campaignRoutes.ts`, `components/patterns/CorporateChromeGate/`,
`components/patterns/CampaignLanding/` (`CampaignLanding.tsx`,
`SignupForm.tsx`, `actions.ts`, `campaign-icons.tsx`, `.module.css`),
`app/free30/page.tsx`. Modified: `app/layout.tsx` (wraps `Header`/`Footer`
in the new gate), `components/ui/FormField/FormField.tsx` (added an
optional `hideLabel` prop, `TextField`-only, for the compact email
capsule), `.env.example`.

**No corporate nav, without restructuring routing.** Considered moving
every existing route into a route group with its own layout (the
"textbook" way to get a second root-layout-less chrome), but that's a
~15-folder mechanical move for zero behavioural gain. Considered reading
`headers()`/pathname in the shared root layout, but that forces the
_entire_ site into dynamic rendering (see `next.config.ts`'s own CSP
comment on why per-request rendering was deliberately avoided for this
mostly-static site) — a real regression, not an acceptable trade for one
new page. Landed on `CorporateChromeGate`: a client component using
`usePathname()` (resolved per static page at render/build time, so it
doesn't force dynamic rendering the way `headers()` would) that renders
or discards `Header`/`Footer` — passed in as already-server-rendered
children from the root layout (a genuine Server Component), not
re-implemented as client components. Verified with a real production
build: `/free30` is the _only_ route that changed rendering mode
(`ƒ` dynamic, because it reads `searchParams` — unrelated to the gate),
every other route (`/`, `/about`, `/leadership`, `/shop`, etc.) kept
its exact prior static/SSG classification.

**Content** — every line matches the brief's copy verbatim (kicker,
tagline, description, CTA label, reassurance, four benefit points, trust
message, device explanation); nothing invented (no testimonials, stats,
or claims). Zulu + 2 of the ensemble introduced modestly below the
benefits/trust sections using the same already-approved
`playful-tilt` character images the corporate homepage's "Meet the cast"
stamp uses — no new imagery. Primary CTA repeated twice (hero + a dark
`finalCta` section near the bottom), both wired to the same
`SignupForm`/Server Action.

**Signup wiring — real, and deliberately stops at a real gap.** The
Server Action (`actions.ts`) does the full ContactForm-style contract:
honeypot, server-side email validation, in-memory per-IP rate limiting
(same documented single-instance caveat), and — once
`FREE_TRIAL_TO_EMAIL`/`CONTACT_FORM_FROM_EMAIL` are set — a real email
notification via the existing `lib/email.ts` (Resend). Unset (true in
every environment right now), it degrades honestly with a "not fully
connected yet" message, same inert-until-configured contract as
ContactForm/WP7. **It does not provision an actual trial** — no
customer-account/audiobook-delivery/CRM system exists anywhere in this
codebase, and building one wasn't in scope to invent. That's the genuine
unresolved dependency this stops short of, flagged in code comments,
CLAUDE.md, and here — not silently cut.

**Campaign/source extensibility.** `CampaignLanding` takes a `campaign`
slug + optional `content` overrides; `/free30/page.tsx` is a ~10-line
route showing the intended pattern for `/blackpool`/`/pampers`/
`/chester-zoo` later (thin route + `CAMPAIGN_ROUTE_SLUGS` entry — the
one easy-to-forget step, called out in CLAUDE.md). The incoming
`?source=`/`?src=`/`?utm_source=` query param and the fixed `campaign`
value both travel through as hidden form fields into the Server Action,
so a future analytics integration has real per-campaign/per-source data
from day one — no analytics vendor was added or invented, since none
exists in this codebase and picking one is an external-service decision
outside this session's scope (same category as Sanity/Stripe/DNS).

**Accessibility / contrast.** Every new colour pairing (cream-on-dark
hero/footer, honey-gold tagline-on-dark) was checked by relative
luminance (WCAG's formula), not eyeballed — see
`CampaignLanding.module.css`'s file comment for the exact numbers.
Found and fixed one real issue this way: `FormField`'s inline error text
uses `--color-danger`, audited only against light surfaces (6.53:1) —
directly on the dark hero/finalCta background it measured 1.7–2.3:1,
badly failing. Fixed by wrapping the email input + button in a light
`.signupCard` (existing `--color-surface`), so every field-level string
FormField renders (including ones this component can't restyle from
outside) sits on an already-audited light background regardless of which
section the form appears in. Heading hierarchy is a single H1 → sequential
H2s (added two headings — "Why bedtime with Moral Tree Media" over the
benefit list, and promoted the trust statement to an H2 — that didn't
exist in the first draft; confirmed via a real rendered-HTML dump, not
assumed).

**Metadata.** Caught and fixed a doubled brand name in the browser tab
title (`"... — Moral Tree Media | Moral Tree Media"`) — the root
layout's title template already appends `| Moral Tree Media`; the page's
own title shouldn't repeat it. `robots: {index:false, follow:true}` is a
documented default choice (CLAUDE.md), not a hard requirement — flagged
for the owner to override if organic discoverability is wanted too.

## Verification

- `npm run lint` / `typecheck` / `format:check` — all clean (root
  workspace scripts; ran repeatedly through the session as files
  changed, not just once at the end).
- `npm run build` — 33 routes with `USE_MOCK_CONTENT=true` (local
  convenience flag, unrelated to this change).
- Production-parity build (`USE_MOCK_CONTENT=false`, matching Vercel) —
  **23 routes**, i.e. the prior 22 plus `/free30`; every previously
  existing route preserved with its prior rendering mode unchanged.
- `next start` + curl against that build:
  - `/free30`: 200; no `<header>`/`<footer>`/`primary-nav` anywhere in
    the response (corporate chrome genuinely absent, not just hidden by
    CSS); campaign/source hidden fields carry the right values for a
    `?src=blackpool-poster` request; every required copy string present
    verbatim; single H1 + sequential H2s; `<title>` and `robots` meta
    correct.
  - `/`, `/leadership`, `/shop`, `/cart`, `/contact`, `/news`,
    `/story-worlds`, `/checkout/cancelled`: all still 200 with
    `<header>`/`<footer>` present — the gate change has zero effect on
    every route besides `/free30`.
  - Homepage: mission line present with the exact requested text; new
    pillar copy present; `castGrid`/`castSwipeHint`/`mediumsStamp`
    classes all present in the rendered HTML.
  - Compiled CSS fetched and spot-checked directly (not just "the build
    didn't error"): confirmed the mobile-rail rule
    (`overflow-x:auto;scroll-snap-type:x mandatory`) at the base/mobile
    breakpoint and the grid rules reappearing unchanged at
    `min-width:40rem`/`64rem`; confirmed the dark hero gradient rule
    compiled as written.
  - `sitemap.xml`/`robots.txt` unaffected — `/free30` correctly absent
    from the sitemap (noindex), `robots.txt` unchanged.
- One false alarm chased down and ruled out: `/about`'s 404 page also
  has no literal `<header>`/`<footer>` tag in its raw HTML — checked
  against a clean worktree of the _prior_ commit (before any of this
  session's changes, using `git worktree` rather than touching the
  working tree) and confirmed identical, pre-existing behaviour (Next's
  shared static `/_not-found` page), unrelated to `CorporateChromeGate`.
  Not a regression; not fixed (out of scope, and not something this
  session broke).
- No screenshot/browser tool is available in this environment (checked —
  no Playwright/Puppeteer/Chromium present, no `claude-in-chrome` browser
  session active); responsive behaviour at 390/430/768/1024/1280 widths
  was verified by reading the compiled CSS's exact breakpoint rules
  (`min-width: 40rem` = 640px, `48rem` = 768px, `64rem` = 1024px) against
  the requested widths and by computing/checking every new contrast
  pairing, rather than a visual screenshot — flagged here as the one
  verification method this session couldn't use, not silently skipped.
- `backend/`/`mtm-backend.service` confirmed untouched and active
  throughout (checked before and after, same as every prior session).

## Not done / deliberately out of scope

- Real free-trial provisioning (customer accounts, audiobook delivery,
  a CRM/ESP integration) — the genuine unresolved dependency flagged
  above, in code comments, and in CLAUDE.md's "Guidance for future
  sessions". Needs a product decision from the owner on what "free for
  30 nights" delivers technically before it can be built.
- `/blackpool`, `/pampers`, `/chester-zoo` — not built (the brief calls
  these "later variants"); the architecture (`CampaignLanding` +
  `CAMPAIGN_ROUTE_SLUGS`) is ready for them.
- No analytics vendor added — `campaign`/`source` are captured and
  threaded through the funnel; wiring an actual analytics platform is an
  external-service decision outside this session's scope.
- No production deploy — see the accompanying commit; a NON-PRODUCTION
  Vercel preview was created instead, per this session's brief.

## Recommended next step requiring Stuart's decision

1. Visual review of `/free30` and the homepage refinements on the preview
   URL (below) at real phone/tablet/desktop widths.
2. A product decision on what a "free trial" technically grants (account
   system? emailed access links? a third-party listening platform?) —
   blocks turning the signup notification into an actual working trial.
3. Whether `/free30` should be indexable (currently `noindex` by
   default judgement call, not a hard requirement).

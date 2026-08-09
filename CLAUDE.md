# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project status

This is the Moral Tree Media (MTM) website, being built to an approved Phase
One specification (corporate pages, capability pages, a Story World
portfolio system, news, contact, legal pages, a shared design system,
WCAG 2.2 AA accessibility, Core Web Vitals performance, and standard
security/privacy controls).

**All six work packages are functionally complete** (code-wise — see each
WP below). What's left is not code: a real Sanity project/credentials, a
hosting/domain target, and real content/copy/legal text/brand assets. None
of those block further engineering work; they block the site actually
showing real content instead of the honest empty/404 states described
under "Null-handling rules by page" below.

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
  assets land, nothing else should need to change.
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
- `RichText` (Portable Text renderer) resolves `internalLink` marks via an
  optional `resolveInternalLink` prop — no caller passes one yet (would
  need `blockContent`'s `internalLink` annotation dereferenced in GROQ the
  way `LINK_PROJECTION` does for `link` fields; none of WP5's rich-text
  consumers — legal pages, news posts, founder bio — populate it), so
  internal links inside rich text currently render as styled but
  non-interactive text rather than a broken `<a>` with no `href`. Images
  inside rich text and elsewhere go through `urlFor()`
  (`lib/sanity/image.ts`), which accepts a raw `{_ref}` image object
  directly — no need to dereference `asset->url` in GROQ for that case.
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
     by slug) — a missing document is a real 404 (`notFound()`). There's no
     honest non-fabricated fallback for a company's About copy or a
     founder's bio, so don't invent one.
  2. **Site-wide chrome** (root layout's nav/footer/site title) — falls
     back to `lib/siteDefaults.ts`. Global chrome has to work before any
     content exists at all.
  3. **Listing/utility pages** (Leadership's person grid, News' index,
     Story Worlds' index, Contact's form, Home) — render a genuine empty/
     generic state, not a 404 and not fabricated copy. An empty catalogue
     is a normal state; being unreachable (Contact) or 404ing at the
     domain root (Home) would be worse than a plain placeholder.

  † Founder is 1+3 at once: no `page` doc _and_ no founder `person` doc is
  a 404, but either one alone renders something (see `app/founder/page.tsx`).

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
  ones (`ALWAYS_AVAILABLE`: home/leadership/contact/news/story-worlds,
  i.e. every rule-3 listing page above) — otherwise it would point search
  engines at pages that currently 404. It also lists real news-post and
  Story-World slugs directly (not gated on their `page` doc). Update
  `ALWAYS_AVAILABLE` if a page's null-handling rule changes.

## Guidance for future sessions

- Keep this file's work-package checklist current as WPs land.
- Do not touch `backend/` — see above.
- When adding real content/brand assets/hosting target, replace the
  placeholder assumptions from WP1 (Vercel-shaped hosting) if the owner
  specifies otherwise. Self-built cookie consent (`ConsentBanner`) and
  Cloudflare Turnstile for form spam-protection (`ContactForm`) are now
  actually implemented, not just planned — swapping either for a different
  vendor means replacing those specific components/env vars, not starting
  from scratch.
- The contact form's rate limiting is in-memory and single-instance only —
  fine for one Node process, not for a multi-instance serverless
  deployment. Swap in a shared store (Upstash Redis, Vercel KV, etc.) as
  part of picking a real hosting target, not before.
- Adding a Sanity `pageBuilder` block type requires touching three places:
  `apps/studio/schemaTypes/objects/<name>.ts`, its registration in
  `apps/studio/schemaTypes/objects/pageBuilder.ts` and
  `apps/studio/schemaTypes/index.ts`, and (from WP3 onward) a matching
  renderer case in the page-builder component in `apps/web`.

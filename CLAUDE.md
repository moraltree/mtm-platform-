# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project status

This is the Moral Tree Media (MTM) website, being built to an approved Phase
One specification (corporate pages, capability pages, a Story World
portfolio system, news, contact, legal pages, a shared design system,
WCAG 2.2 AA accessibility, Core Web Vitals performance, and standard
security/privacy controls).

Implementation proceeds in work packages:

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
  Card, TextField/TextArea, SkipLink, VisuallyHidden), and a `patterns/`
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
- **WP6 — Story World portfolio system** (index + reusable detail template)
  — not started. Reuses `lib/pageSections.ts`'s adapter, plus needs
  `storyWorldGridBlock`'s data-fetching (still a `PageSections` no-op).

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
  `storyWorldGridBlock`. `storyWorldGridBlock` needs WP6. The other two
  don't have a real consumer _by design_, not because anything's missing:
  Leadership queries `person` documents directly and News' index queries
  `newsPost` directly, since each page's own team/post listing isn't
  something an editor picks per-page. `teamGridBlock`/`newsListBlock` stay
  available for embedding a team grid or news teaser list on some _other_
  page (e.g. a `newsListBlock` on Home) — that's the actual trigger for
  giving either a real `PageSections` case. `formEmbedBlock` is real since
  WP4 (see ContactForm below).
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
  3. **Listing/utility pages** (Leadership's person grid, News' post grid,
     Contact's form, Home) — render a genuine empty/generic state, not a
     404 and not fabricated copy. An empty team or post list is a normal
     state; being unreachable (Contact) or 404ing at the domain root
     (Home) would be worse than a plain placeholder.

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
  ones (home/leadership/contact/news) — otherwise it would point search
  engines at pages that currently 404. Update its `ALWAYS_AVAILABLE` list
  if a page's null-handling rule changes.

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

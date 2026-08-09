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
- **WP4 — Corporate shell, legal/error routes, global metadata** — not started.
  Wires real `Header`/`Footer`/`SkipLink` into the root layout with live
  `siteSettings` data (`/style-guide` renders them standalone today), adds
  legal/error routes, sitemap/robots, security headers, cookie consent, and
  the real contact form (`formEmbedBlock`'s renderer).
- **WP5 — Core corporate pages** (Home, About, Founder, Leadership, Mission,
  Publishing, Audiobooks, Animation, News, Contact) — not started. Will
  consume `apps/web/src/lib/sanity/queries.ts` + `PageSections`, and needs
  the Sanity → `PageSection` adapter (see Architecture notes) plus the
  `teamGridBlock`/`newsListBlock` data-fetching `PageSections` currently
  no-ops on.
- **WP6 — Story World portfolio system** (index + reusable detail template)
  — not started. Needs the same adapter, plus `storyWorldGridBlock`'s
  data-fetching.

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
  Header, Footer) plus `PageSections`, which switches on a section's
  `_type` to render it. `PageSections`' components are deliberately
  presentational — they take plain resolved props (`href: string`, already-
  built image `src`), not raw Sanity objects. The adapter that turns a
  fetched `page`/`storyWorld` document's `sections` array (raw Sanity JSON:
  `link` objects with `internalRef`/`externalUrl`, image refs, etc.) into
  `PageSection[]` does not exist yet — build it in WP4/WP5 alongside the
  first real page, once there's real data to shape it against. Don't
  speculatively build it against guessed data shapes.
- Four pageBuilder block types are CMS-data-driven, not presentational:
  `teamGridBlock`, `storyWorldGridBlock`, `newsListBlock`, `formEmbedBlock`.
  `PageSections` currently renders `null` for all four (see its switch
  statement) rather than fake/partial output. Each gets wired up when its
  real data source lands: `teamGridBlock`/Leadership in WP5, `newsListBlock`
  in WP5, `storyWorldGridBlock` in WP6, `formEmbedBlock` (the actual
  contact form + spam/rate protection) in WP4.
- `RichText` (Portable Text renderer) resolves `internalLink` marks via an
  optional `resolveInternalLink` prop — until a caller passes one (WP4/5,
  once GROQ projections dereference the annotation's `reference`), internal
  links render as styled but non-interactive text rather than a broken
  `<a>` with no `href`. Images inside rich text and elsewhere go through
  `urlFor()` (`lib/sanity/image.ts`), which accepts a raw `{_ref}` image
  object directly — no need to dereference `asset->url` in GROQ for that
  case.
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
  building without live credentials. Once a project exists: set
  `SANITY_STUDIO_PROJECT_ID`/`_DATASET` in `apps/studio/.env` and the
  matching `NEXT_PUBLIC_SANITY_*` vars in `apps/web/.env.local`. WP5/WP6
  pages should treat a `null` fetch result as a real error, not silently
  render empty — the graceful-degradation behavior is a bootstrapping
  convenience, not a permanent contract.
- `page` documents use a fixed `pageId` (see the option list in
  `apps/studio/schemaTypes/documents/page.ts` and `PAGE_IDS` in
  `apps/studio/structure.ts`) so Home/About/Founder/etc. are pinned
  singletons in the Studio rather than editor-creatable duplicates.
  `storyWorld`, `newsPost`, `person`, `legalPage` are open document lists.

## Guidance for future sessions

- Keep this file's work-package checklist current as WPs land.
- Do not touch `backend/` — see above.
- When adding real content/brand assets/hosting target, replace the
  placeholder assumptions from WP1 (Vercel-shaped hosting, self-built
  cookie consent, Cloudflare Turnstile for form spam-protection) if the
  owner specifies otherwise.
- Adding a Sanity `pageBuilder` block type requires touching three places:
  `apps/studio/schemaTypes/objects/<name>.ts`, its registration in
  `apps/studio/schemaTypes/objects/pageBuilder.ts` and
  `apps/studio/schemaTypes/index.ts`, and (from WP3 onward) a matching
  renderer case in the page-builder component in `apps/web`.

# studio

Sanity Studio for Moral Tree Media content. See root [`CLAUDE.md`](../../CLAUDE.md)
for overall project context.

## Setup

This needs a real Sanity project before it can run against live content:

1. Create a project at [sanity.io/manage](https://www.sanity.io/manage) (or
   run `npx sanity init` from this directory and follow the prompts).
2. `cp .env.example .env` and fill in `SANITY_STUDIO_PROJECT_ID` /
   `SANITY_STUDIO_DATASET`.
3. `npm run dev` (from this directory, or `npm run dev --workspace=studio`
   from the repo root).

## Schema

- `schemaTypes/documents/` — `page` (generic, reused for every corporate/
  capability page via a fixed `pageId`), `storyWorld`, `newsPost`,
  `person`, `legalPage`, `siteSettings` (singleton).
- `schemaTypes/objects/` — shared primitives (`seo`, `link`,
  `blockContent`) and the `pageBuilder` section types (hero, rich text, CTA
  panel, media, quote, timeline, stats, card grid, team grid, Story World
  grid, news list, form embed) — one per design-system pattern in the
  Phase One spec.
- `structure.ts` — pins `siteSettings` and one `page` per fixed `pageId` as
  singletons so editors can't create duplicates.

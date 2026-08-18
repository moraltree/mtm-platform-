# `hero-scenes/` — planned, not yet populated

Reserved for homepage/marketing hero and banner imagery (Phase 1 of the
website update prepares this directory; it does not generate anything
into it — see `/logs/website-update/` for the working log and report).

The master asset library's `PRODUCTION_MANIFEST.md` (§8, `12-hero-images/`)
lists 6 candidate hero/marketing images (cast lineup, homepage banner,
Story World index card, social square, vertical poster, favicon
candidate) and marks that whole section **EXCLUDED pending clarification**
— most read as multi-character composites, not confirmed single-character
shots, and weren't approved alongside the 136-image single-character
batch. That exclusion still stands; nothing in this Phase 1 pass changes
it.

Until real hero-scene imagery is approved and generated, the homepage
temporary hero uses a single approved character pose (Zulu's
three-quarter-wave website pose, from `../zulu/`) referenced via
`apps/web/src/lib/characters.ts` — see that file and `src/app/page.tsx`.
That's a stand-in, not a hero-scene image; swap it for a real file from
this folder once one exists, by changing `HOME_HERO_IMAGE` in
`src/app/page.tsx`.

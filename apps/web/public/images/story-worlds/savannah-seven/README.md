# `story-worlds/savannah-seven/` — Story World hero/key art

`hero.png` — copied (not moved, not generated, not recompressed) from
`~/mtm-assets/story-worlds/zulu-savannah-seven/12-hero-images/
hero-03-story-worlds-index-card-crop-16x9.png`, one of the two ✅ "done"
Session 12 hero images in that library's `PRODUCTION_MANIFEST.md`
(Section 8, item 3) — produced and pre-cropped specifically for
`storyWorld.heroImage` ("shared 4:3 card / 16:9 detail hero").

Only the 16:9 crop is used here: the current `storyWorld` schema has one
`heroImage` field serving both `/story-worlds` (4:3 `Card`, `object-fit:
cover`) and `/story-worlds/[slug]` (16:9 detail hero, `object-fit: cover`).
The 16:9 variant was chosen over the 4:3 alternative because a wide
source cropped narrower by CSS loses width, not height — keeping the
manifest's deliberate top-biased framing (full tree canopy + all feet in
frame) intact at the card's smaller aspect ratio too. Cropping the 4:3
variant up to 16:9 instead would have cut into that same framing at the
detail hero, the larger and more prominent of the two placements. A real
Sanity project can later store the native image with a hotspot and let
Sanity's own pipeline serve both crops from one asset, as designed
generally — this is a temporary single-crop substitute (see
`lib/storyWorlds/registry.ts`'s doc comment).

Referenced by `lib/storyWorlds/registry.ts` (a local-file `SanityImageRef`,
resolved by `lib/sanity/image.ts#urlFor`'s `local-file:` case, not the
Sanity CDN). Master original under `~/mtm-assets/` untouched (copy only).

# `pairs/` — planned, not yet populated

Reserved for two-character images (Phase 1 of the website update prepares
this directory; it does not generate anything into it — see
`/logs/website-update/` for the working log and report).

## Planned pair programme (12 pairs)

1. Zulu + Zala
2. Zulu + Nara
3. Zulu + Mango
4. Zulu + Lulu
5. Zulu + Sid
6. Zulu + Rocky
7. Zulu + Kofi
8. Zala + Lulu
9. Mango + Sid
10. Rocky + Kofi
11. Nara + Lulu
12. Mango + Rocky

(A broader 20-pair shot list with specific pose/action briefs per pair
also exists in the master asset library's
`story-worlds/zulu-savannah-seven/PRODUCTION_MANIFEST.md`, section 4 —
this 12-pair list is the programme as scoped for the website update.)

## Generation pipeline (already exists — not part of this repo)

`~/mtm-assets/scripts/xai-image-edit.sh` calls xAI's reference-conditioned
`/v1/images/edits` endpoint (model `grok-imagine-image-quality`). It
accepts 1-3 reference images (`-r`, repeatable) plus a text prompt and
output path, and already enforces xAI's real limit of **at most 3
reference images per call** — a pair image (2 characters -> 2 reference
images, one `01-master-reference` file per character) fits this
comfortably. Multi-image reference conditioning was confirmed working in
the master library's Session 3 (see `PRODUCTION_MANIFEST.md`) after a
payload-shape bug was fixed: 2-3 references must be sent as a bare array
of data-URI strings, not an array of `{url,type}` objects.

**Status: capability confirmed working, no pair image generated yet under
this programme** (one earlier Zulu+Zala diagnostic test exists, done as
part of confirming the fix — see `PRODUCTION_MANIFEST.md`'s "unexplained
concurrent activity" note; it was not treated as approved production
output). Generating the 12 (or 20) pair images is a separate, explicit
approval step, same as the single-character batch was — this Phase 1 pass
only prepares the directory and documents the pipeline.

## Before running a production pair batch

- `XAI_API_KEY` must be set in the environment that runs the script (not
  printed/logged by the script; confirmed unset in the session that did
  this Phase 1 pass).
- Each call should pass exactly the two relevant characters'
  `01-master-reference` images as `-r` — the same tier-1 identity-lock
  source used for all 136 single-character images — plus a scene-specific
  prompt built from `PRODUCTION_MANIFEST.md`'s prompt template.
- The script's automatic "try multi-image, fall back to single-reference
  on any 4xx" behaviour stays as a safety net; a 4xx on a pair call costs
  nothing extra since only a 200 response bills.
- Save the resulting file here as `{character-a}-{character-b}-pair-{brief-slug}.png`.

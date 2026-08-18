# `groups/` — planned, not yet populated

Reserved for small-group (3-4 character) images (Phase 1 of the website
update prepares this directory; it does not generate anything into it —
see `/logs/website-update/` for the working log and report).

## Planned small-group programme (6 groups)

1. Zulu + Zala + Mango
2. Zulu + Lulu + Nara
3. Zulu + Rocky + Kofi
4. Zulu + Sid + Mango
5. Zulu + Zala + Rocky + Kofi (4 characters)
6. Zulu + Lulu + Nara + Sid (4 characters)

(A broader 12-scene shot list with specific briefs also exists in the
master asset library's
`story-worlds/zulu-savannah-seven/PRODUCTION_MANIFEST.md`, section 5 —
this 6-group list is the programme as scoped for the website update.)

## The 3-reference-image ceiling — read before generating anything here

`~/mtm-assets/scripts/xai-image-edit.sh` (see `pairs/README.md` for how it
works) enforces **at most 3 reference images per call**, matching xAI's
own documented limit for `/v1/images/edits`. Groups 1-4 above (3
characters each) fit directly: one `01-master-reference` image per
character, 3 references, 1 call.

**Groups 5-6 (4 characters) do not fit** and need an explicit design
decision before any generation is attempted — options noted in
`PRODUCTION_MANIFEST.md` (§5) and left open, not decided by this Phase 1
pass:

- Reference-condition on 3 of the 4 characters and describe the 4th by
  text prompt only (weakest identity-lock on that one character).
- Generate the 4-character scene as two overlapping 3-reference passes
  and composite, or accept a lower-fidelity single pass.
- Reduce scope to the 4-character group's most important 3 members.

Do not silently drop this to a 3-reference call without the owner
choosing one of these (or another) approach — a mismatch between the
prompt's character list and what was actually reference-conditioned is
exactly the kind of identity-drift risk `PRODUCTION_MANIFEST.md`'s
identity-lock system exists to prevent.

## Status

No small-group image has been generated under this programme. Generating
groups 1-4 is technically unblocked (3-reference calls, same as the
single-character batch); groups 5-6 need the above decision first.
Generating anything here is a separate, explicit approval step — this
Phase 1 pass only prepares the directory and documents the constraint.

Save results here as
`{lead-character}/{NN}-{character-a}-{character-b}-{character-c}[-{character-d}]-{brief-slug}.png`
per character subfolder if following `PRODUCTION_MANIFEST.md`'s existing
`{lead-character}/06-group-interactions/` convention, or flat in this
folder — whichever the owner prefers when this programme is actually
approved to run.

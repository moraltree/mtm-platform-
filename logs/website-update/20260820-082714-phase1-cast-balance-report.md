# Phase 1 Website Update — "Meet the cast" report

Completed: 2026-08-20 (server-local time)

## Starting state (inspected before changing anything)

- Branch: `main`, working tree clean at start, HEAD `195c979` ("Hero: fix
  Zulu image crop and warm up headline colour").
- Read `CLAUDE.md`, `DEPLOYMENT.md`, `PROGRESS.md`, and both
  `logs/website-update/20260818-184800-*` files (the prior "Phase 1"
  session that introduced the brown/cream palette and the character asset
  manifest) to establish exactly what already existed before doing
  anything — see those files for full prior-session detail, not repeated
  here.
- Confirmed already done, not re-done: brown/cream palette in
  `tokens.css` (audited, consistent, no stray hex values outside it or
  the intentionally-non-token `PreviewBanner`), 48 approved character
  website-pose images already on disk under
  `apps/web/public/images/characters/{slug}/`, `lib/characters.ts`
  manifest, homepage hero already using Zulu's three-quarter-wave pose.
- Confirmed `backend/` untouched and `mtm-backend.service` still active
  before and after this session (systemd check, git status on `backend/`).

## Gap identified

Priority 4 of this session's brief ("Zulu as lead, balanced
representation of the other seven") was not yet satisfied:
`lib/characters.ts#getEnsembleCharacters()` — a function the prior
session wrote specifically for this purpose, per its own doc comment —
had no caller anywhere in the codebase. Zulu appeared once (the Hero);
Zala/Nara/Mango/Lulu/Sid/Rocky/Kofi appeared nowhere.

Checked every other rule-3 listing page (Leadership, Story Worlds index,
Shop, News, Contact) for a natural second spot: all of them render real
Sanity-backed data (people/story worlds/products/posts) with a
legitimate empty state when that data doesn't exist yet — not a
appropriate place to drop in decorative character art. The homepage
null-state (already the one page carrying hand-authored, clearly-scoped
placeholder content, per CLAUDE.md's null-handling rule 3) was the only
consistent, non-fabricating place to add this.

## Change made

`apps/web/src/app/page.tsx` / `home.module.css` (homepage null-state
branch only, same scope as the prior session's hero change — nothing
here runs once a real Sanity `home` page document exists):

- New "Meet the cast" section, inserted between the existing "Story
  World reveals coming soon" teaser and "How our stories reach families".
  Renders all seven ensemble characters (`getEnsembleCharacters()`) as an
  equal-sized circular-portrait grid (`close-up-headshot` pose,
  manifest-provided alt text, canonical name only — no invented species/
  personality/backstory copy, consistent with `lib/characters.ts`'s own
  documented constraint). Zulu is not repeated in this grid — he's
  already the Hero image, which is how "lead but balanced" was read here
  (equal billing among the other seven, without diluting his existing
  lead placement).
- One small copy fix for internal consistency: the Story World teaser's
  text previously said "Character, setting, and synopsis details are
  still in development" — literally contradicting a same-page section
  that now shows named characters. Narrowed it to "Setting and synopsis
  details are still in development" and added a one-line pointer to the
  new section. Setting/plot/title remain un-revealed, matching the
  "Coming soon" framing the prior session deliberately established — only
  the character-detail clause changed, since it was the one no longer
  true.
- One section's background swapped from plain to
  `sectionSubtle` ("How our stories reach families") purely to restore
  the page's existing plain/subtle alternating rhythm now that a new
  plain section sits in between — same tokens, same pattern already used
  by every other section on the page, no new colours introduced.
- No image assets touched, generated, or moved — only the 7 ensemble
  characters' already-approved `close-up-headshot` files (part of the 48
  copied in by the prior session) are referenced, via the existing
  manifest. Confirmed all three sampled files (Zulu, Kofi, Lulu) depict
  non-human animal characters only, consistent with the "no humans in
  Savannah Seven imagery" constraint.

## Verification

- `npm run lint` — clean (both workspaces).
- `npm run typecheck` — clean (both workspaces; route types regenerated).
- `npm run format:check` — clean (one file reformatted with
  `prettier --write` after the edit, then re-verified clean).
- `npm run build` — succeeded, 33 routes (local `.env.local` still has
  `USE_MOCK_CONTENT=true`, unrelated to this change).
- Additional build with `USE_MOCK_CONTENT=false` (matching Vercel
  production config) — succeeded, 22 routes, same count as before this
  change.
- `next start` + curl against the `USE_MOCK_CONTENT=false` build:
  homepage 200; response HTML contains all seven ensemble characters'
  image paths (`zala`, `nara`, `mango`, `lulu`, `sid`, `rocky`, `kofi`)
  each exactly once, `zulu-website-02-three-quarter-wave.png` exactly
  once (not duplicated into the new grid), correct per-character alt
  text (e.g. `"Kofi — close-up headshot"`), and a clean, correctly
  ordered `<h2>` sequence (no heading-hierarchy regression). No dev
  server processes left running afterward.
- `backend/` confirmed untouched (`git status --porcelain backend/`
  clean) and `mtm-backend.service` confirmed still `active` via
  `systemctl is-active`.

## Not done / deliberately out of scope

- No production deploy. Per this session's brief (`Do not deploy unless
the existing workflow explicitly establishes it's safe and intended`)
  — the existing workflow (`vercel --prod` from `apps/web`) is manual and
  documented as such precisely so a deploy is a deliberate, separate
  step, not implied by a commit. Leaving this commit un-deployed for the
  owner to review live-preview or push out at their own discretion,
  consistent with how the prior session held its own deploy pending
  review before eventually shipping it in a follow-up commit.
- No further placeholder-imagery sweep beyond what's documented above —
  the remaining `/placeholder.png` uses (homepage's unrevealed Story
  World teaser image, the style-guide's internal demo swatch,
  mock-content's fallback) were re-checked and are each still correct to
  leave alone for the same reasons the prior session documented (using a
  Zulu image there would misleadingly suggest the Story World itself has
  been revealed).
- No pair/group/hero-scene image generation — still blocked on the same
  explicit-approval gate the prior session documented
  (`public/images/characters/{pairs,groups,hero-scenes}/README.md`);
  nothing changed about that this session.
- No palette/token changes — the brown/cream system audited clean, no
  inconsistency found worth touching.

## Recommended next step requiring Stuart's decision

- Owner visual review of the new "Meet the cast" section (grid density,
  whether all seven at once reads as busy versus rotating a subset, and
  whether the loosened teaser copy still reads correctly) before any
  production deploy.

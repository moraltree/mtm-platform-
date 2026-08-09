# Progress log

Concise, dated record of autonomous work sessions on this repo. Full detail
lives in `git log`; current architecture/status lives in `CLAUDE.md`. Newest
entries first.

## 2026-08-09 (session 2 — continuation)

- Starting point: WP1–WP6 all committed (`46cd57c`..`7ba168e`), every route
  verified against `null` Sanity data (honest 404s/fallbacks, no fabricated
  content).
- Task: add stub/preview content so every route actually renders for visual
  review, run/test the whole app, fix anything broken, then continue with
  the next logical, in-scope work. No new external accounts/credentials
  used or requested (none needed for this phase).
- Built `lib/mockContent.ts` + `USE_MOCK_CONTENT` opt-in flag: every
  `queries.ts` function falls back to stub data only when Sanity is
  unconfigured _and_ the flag is set (never in CI/production by default).
  Layered safety: persistent on-page `PreviewBanner`, forced
  `noindex`/`disallow: /`, empty sitemap — all four gated off one flag.
  All 25 routes (17 base + 2 legal + 3 news + 3 Story World details) now
  render 200 with real layout/content for visual review.
- Testing this surfaced a genuine, previously-undetected bug: every
  route's `generateMetadata` was unconditionally including
  `description`/`robots` keys even when `undefined`, which (per Next's
  metadata-merging rules) silently deleted the root layout's default
  description on _every_ page, real content or not. Fixed site-wide via
  a new `lib/metadata.ts#buildMetadata` helper; verified fixed with mock
  content on and confirmed unchanged (still honest 404s, description now
  present) with it off.
- Verified: lint/typecheck/format/build clean; `sanity build` clean;
  `next start` + curl across every route in both mock-on and mock-off
  states; `mtm-backend.service` checked active throughout.
- Committed as `stub content + mock-mode testing pass` (see git log).
- Follow-up spec-compliance check (WCAG 2.2 AA is an explicit spec
  requirement, and the token palette was designed by eye, not verified):
  computed WCAG relative-luminance contrast ratios for every foreground/
  background colour pairing actually used across the codebase. Found one
  real failure — `--color-text-muted` on `--color-surface-subtle`
  (Hero subheading, Footer links, Badge) at 4.27:1, below the 4.5:1 AA
  floor for normal text. Fixed by darkening `--color-ink-500` from
  `#6b7280` to `#666c78` (4.66:1 there, 5.27:1 against white — margin on
  both, and CtaPanel's opacity-blended text checked separately and found
  already well clear at ~12:1/~8:1). Rebuilt and reconfirmed clean.

## 2026-08-09 (session 1)

- WP1 Foundation, WP2 Sanity CMS/schemas, WP3 design system, WP4 corporate
  shell/security/consent/contact form, WP5 core corporate pages, WP6 Story
  World portfolio system. All committed and verified (lint/typecheck/
  format/build/`sanity build` clean at each checkpoint).

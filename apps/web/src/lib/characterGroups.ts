/**
 * Full-cast (7–8 character) group image manifest — a small, separate
 * companion to `lib/characters.ts` (which only covers single-character
 * website poses). Source: the master asset library's
 * `15-approved/` subset (see
 * `public/images/characters/full-cast/README.md` for the exact
 * provenance/audit trail) — copied in, not generated. No new imagery was
 * produced for this; these three images already existed and were already
 * marked website-use ready.
 *
 * Deliberately minimal (slug, path, alt, a one-line `mood` used only for
 * picking which image suits a given placement) — same "no invented canon"
 * constraint as `characters.ts`.
 */

export interface CharacterGroupImage {
  slug: string;
  path: string;
  alt: string;
  mood: string;
}

export const CHARACTER_GROUPS: CharacterGroupImage[] = [
  {
    slug: "group-portrait",
    path: "/images/characters/full-cast/full-cast-01-group-portrait.png",
    alt: "Zulu and the whole cast gathered together for a group portrait",
    mood: "warm studio portrait",
  },
  {
    slug: "sunset-silhouette",
    path: "/images/characters/full-cast/full-cast-05-sunset-silhouette-warm.png",
    alt: "Zulu and the whole cast together at sunset",
    mood: "warm end-of-day",
  },
  {
    slug: "storytime-circle",
    path: "/images/characters/full-cast/full-cast-09-storytime-circle.png",
    alt: "Zulu and the whole cast gathered around an open storybook",
    mood: "storytime",
  },
];

export function getCharacterGroup(
  slug: string,
): CharacterGroupImage | undefined {
  return CHARACTER_GROUPS.find((g) => g.slug === slug);
}

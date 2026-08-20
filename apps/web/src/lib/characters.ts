/**
 * Character asset manifest — Zulu the Zebra & The Savannah Seven (Phase 1
 * of the website update, see /logs/website-update/ for the working log).
 *
 * Source of truth for what's on disk: the eight character subfolders
 * under `public/images/characters/` (`zulu`, `zala`, `nara`, `mango`,
 * `lulu`, `sid`, `rocky`, `kofi`), copied — not moved — from each
 * character's `03-website-poses/` folder in the master asset library
 * (`~/mtm-assets/story-worlds/zulu-savannah-seven/`; see that library's
 * `PRODUCTION_MANIFEST.md` for how these were produced). The master
 * originals are untouched by this copy.
 *
 * Deliberately minimal: canonical name, slug, order, lead/ensemble flag,
 * and the six approved website-pose images (filename, public path, and an
 * image "role" inferred from the filename's own suffix, e.g.
 * `front-portrait`/`three-quarter-wave`). No species, personality, or
 * backstory fields — that canon doesn't exist in this repository yet, and
 * this file isn't the place to invent it.
 *
 * `isLead` exists so consuming components can deliberately balance
 * representation (CLAUDE.md/the Phase 1 brief: Zulu is the named lead of
 * "Zulu the Zebra & The Savannah Seven" but the finished site must not
 * become visually dominated by him) — e.g. `getEnsembleCharacters()` for
 * a section that should rotate through the other seven, rather than every
 * section separately hardcoding `"zulu"` or an exclusion list.
 */

export type CharacterSlug =
  "zulu" | "zala" | "nara" | "mango" | "lulu" | "sid" | "rocky" | "kofi";

/** Inferred from each website-pose filename's own suffix — see the six
 * `{character}-website-{NN}-{suffix}.png` files under each character's
 * `03-website-poses/` folder in the master asset library. */
export type WebsitePoseRole =
  | "front-portrait"
  | "three-quarter-wave"
  | "sitting-look-up"
  | "standing-full-body"
  | "close-up-headshot"
  | "playful-tilt";

export interface WebsitePoseImage {
  role: WebsitePoseRole;
  filename: string;
  /** Public path under `public/`, ready to pass straight to `next/image`. */
  path: string;
  alt: string;
}

export interface Character {
  slug: CharacterSlug;
  canonicalName: string;
  /** 1-8, matching the master asset library's numbered character folders
   * (`01-zulu` … `08-kofi`). */
  order: number;
  /** True only for Zulu — see the file-level doc comment. */
  isLead: boolean;
  /** Relative standing height, Zulu = 1.00 — the master asset library's
   * own owner-approved canonical scale/composition reference
   * (`14-batch2-corrected/savannah-seven-scale-lineup-batch2-v1.png` and
   * its `AUDIT-NOTES.md`, Session 15: "APPROVED as the canonical visual/
   * composition scale reference"). Real production canon, not invented
   * here — any layout that places two or more characters together at a
   * meaningful size (a hero composition, a group scene) should size
   * them proportionally to this, not treat every character as
   * interchangeable. Lulu/Nara/Mango's figures carry a documented
   * sitting-pose measurement caveat (no standing-pose source art exists
   * for them) but are still the approved reference values to design
   * against. */
  relativeScale: number;
  websitePoses: WebsitePoseImage[];
}

// Ordered the same way as the master asset library's numbered folders
// (01-zulu … 08-kofi). Canonical names are exactly the character names
// used throughout this repository (folder names, PRODUCTION_MANIFEST.md,
// the "Zulu the Zebra & The Savannah Seven" Story World name) — nothing
// invented here.
const CHARACTER_DEFS: Array<
  Pick<
    Character,
    "slug" | "canonicalName" | "order" | "isLead" | "relativeScale"
  >
> = [
  {
    slug: "zulu",
    canonicalName: "Zulu",
    order: 1,
    isLead: true,
    relativeScale: 1.0,
  },
  {
    slug: "zala",
    canonicalName: "Zala",
    order: 2,
    isLead: false,
    relativeScale: 1.9,
  },
  {
    slug: "nara",
    canonicalName: "Nara",
    order: 3,
    isLead: false,
    relativeScale: 0.55,
  },
  {
    slug: "mango",
    canonicalName: "Mango",
    order: 4,
    isLead: false,
    relativeScale: 0.4,
  },
  {
    slug: "lulu",
    canonicalName: "Lulu",
    order: 5,
    isLead: false,
    relativeScale: 0.75,
  },
  {
    slug: "sid",
    canonicalName: "Sid",
    order: 6,
    isLead: false,
    relativeScale: 0.25,
  },
  {
    slug: "rocky",
    canonicalName: "Rocky",
    order: 7,
    isLead: false,
    relativeScale: 1.15,
  },
  {
    slug: "kofi",
    canonicalName: "Kofi",
    order: 8,
    isLead: false,
    relativeScale: 1.4,
  },
];

// The six approved website poses, in filename order, with the plain-
// English fragment used to build each image's alt text. Every character
// has exactly these six files (`{slug}-website-01-front-portrait.png` …
// `{slug}-website-06-playful-tilt.png`) — one shared template instead of
// 48 hardcoded paths.
const POSE_SEQUENCE: Array<{
  role: WebsitePoseRole;
  suffix: string;
  altFragment: string;
}> = [
  {
    role: "front-portrait",
    suffix: "01-front-portrait",
    altFragment: "front-facing portrait",
  },
  {
    role: "three-quarter-wave",
    suffix: "02-three-quarter-wave",
    altFragment: "three-quarter view, waving",
  },
  {
    role: "sitting-look-up",
    suffix: "03-sitting-look-up",
    altFragment: "sitting, looking up",
  },
  {
    role: "standing-full-body",
    suffix: "04-standing-full-body",
    altFragment: "standing, full body",
  },
  {
    role: "close-up-headshot",
    suffix: "05-close-up-headshot",
    altFragment: "close-up headshot",
  },
  {
    role: "playful-tilt",
    suffix: "06-playful-tilt",
    altFragment: "playful head tilt",
  },
];

function buildWebsitePoses(
  slug: CharacterSlug,
  canonicalName: string,
): WebsitePoseImage[] {
  return POSE_SEQUENCE.map(({ role, suffix, altFragment }) => {
    const filename = `${slug}-website-${suffix}.png`;
    return {
      role,
      filename,
      path: `/images/characters/${slug}/${filename}`,
      alt: `${canonicalName} — ${altFragment}`,
    };
  });
}

/** The full eight-character manifest, ordered 1-8 (Zulu first). */
export const CHARACTERS: Character[] = CHARACTER_DEFS.map((def) => ({
  ...def,
  websitePoses: buildWebsitePoses(def.slug, def.canonicalName),
})).sort((a, b) => a.order - b.order);

const CHARACTERS_BY_SLUG: Record<CharacterSlug, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [c.slug, c]),
) as Record<CharacterSlug, Character>;

export function getCharacter(slug: CharacterSlug): Character {
  return CHARACTERS_BY_SLUG[slug];
}

export function getAllCharacters(): Character[] {
  return CHARACTERS;
}

/** Zulu — the one character with `isLead: true`. */
export function getLeadCharacter(): Character {
  const lead = CHARACTERS.find((c) => c.isLead);
  if (!lead) throw new Error("No lead character defined in CHARACTERS");
  return lead;
}

/** The other seven — for sections that should deliberately not default to
 * Zulu, so the site doesn't end up visually dominated by the lead. */
export function getEnsembleCharacters(): Character[] {
  return CHARACTERS.filter((c) => !c.isLead);
}

/** A single named pose for a character, or `undefined` if that role isn't
 * available for them (every character currently has all six, but callers
 * shouldn't assume that stays true forever). */
export function getCharacterPose(
  slug: CharacterSlug,
  role: WebsitePoseRole,
): WebsitePoseImage | undefined {
  return getCharacter(slug)?.websitePoses.find((p) => p.role === role);
}

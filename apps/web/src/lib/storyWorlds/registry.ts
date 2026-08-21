import { getAllCharacters } from "../characters";
import type {
  CharacterRosterEntry,
  SanityImageRef,
  StoryWorldDoc,
} from "../sanity/types";

/**
 * Real, production-visible Story World seed content — consulted by
 * `lib/sanity/queries.ts` (`getStoryWorlds`/`getFeaturedStoryWorlds`/
 * `getStoryWorldBySlug`) only when no real Sanity `storyWorld` document
 * exists for a given slug yet. Deliberately distinct from:
 *
 * - `lib/mockContent.ts`'s `mockStoryWorlds` — fictional/demo placeholder
 *   data, gated behind `USE_MOCK_CONTENT`, noindexed, preview-bannered.
 *   Never real, never live in production.
 * - `lib/devRecords.ts`'s `devStoryWorlds` (River Rangers) — a real
 *   Story World, but a *campaign-platform* validation fixture reached
 *   only via `getStoryWorldByKey`/the campaign repository, not the
 *   corporate `/story-worlds` route this file feeds.
 *
 * This is temporary seed/default content, not a second permanent CMS:
 * `queries.ts` always tries the real Sanity result first
 * (`if (result) return result`) and only falls back to this registry
 * when that's null — the same "no page document → real hand-authored
 * fallback, not a null-state" precedent CLAUDE.md documents for Home's
 * own homepage. The moment a real Sanity project has a real `storyWorld`
 * document for a slug below, Sanity's result wins automatically and this
 * entry is simply never consulted again for that slug — nothing to
 * migrate or tear out by hand.
 *
 * Only populate an entry here once a Story World has real, owner-
 * approved content/assets (see each entry's own comment for provenance).
 * A Story World with no entry here — River Rangers, Firefly Hollow,
 * Ocean World, etc. — is not an error: it simply isn't listed yet, the
 * same honest "coming soon" empty/404 behaviour every other unpopulated
 * listing in this codebase already uses. Do not add a stub entry for a
 * Story World that has no real approved content — see this repository's
 * "no invented content" convention.
 */

/** A `SanityImageRef` pointed at a real file under `public/` instead of a
 * Sanity CDN asset — resolved by `lib/sanity/image.ts#urlFor`'s
 * `local-file:` case. Every existing image consumer
 * (`urlFor(x)?.width(n).url()`) keeps working unchanged. */
function localImage(path: string, alt: string): SanityImageRef {
  return { asset: { _ref: `local-file:${path}`, _type: "reference" }, alt };
}

function span(text: string) {
  return { _type: "span" as const, text, marks: [] as string[] };
}
function block(text: string) {
  return {
    _type: "block" as const,
    style: "normal" as const,
    markDefs: [] as unknown[],
    children: [span(text)],
  };
}
/** Minimal Portable Text builder — mirrors `mockContent.ts`'s own
 * (unexported) `richText` helper's shape, kept as a separate, self-
 * contained copy here rather than importing from that fictional-content
 * module. */
function richText(...paragraphs: string[]) {
  return paragraphs.map(block);
}

// Every character's approved front-facing portrait, reused as-is from
// the single source of truth (lib/characters.ts) — not re-typed or
// re-approved here, so there is exactly one place that can be wrong
// about a character's name, scale, or image path.
const characterRoster: CharacterRosterEntry[] = getAllCharacters().map(
  (character) => {
    const portrait =
      character.websitePoses.find((pose) => pose.role === "front-portrait") ??
      character.websitePoses[0];
    return {
      name: character.canonicalName,
      portrait: portrait ? localImage(portrait.path, portrait.alt) : undefined,
      relativeScale: character.relativeScale,
      // All eight are the real, established, site-wide cast (already
      // used unrestricted on /free30 and the homepage) — not a
      // provisional roster awaiting individual approval.
      approvedForCampaign: true,
    };
  },
);

/**
 * Zulu the Zebra & The Savannah Seven — Moral Tree Media's first Story
 * World, and the only one with a real, owner-approved character/hero
 * asset library today (see `lib/characters.ts`'s own doc comment and
 * `~/mtm-assets/story-worlds/zulu-savannah-seven/PRODUCTION_MANIFEST.md`).
 * `key: "zulu"` matches the durable cross-system identifier already
 * used as this schema field's own worked example
 * (`storyWorld.ts`) — set once, distinct from the editable `slug` below.
 *
 * No audiobook catalogue, merchandise, or campaign links are wired here
 * — `audiobookContentRefs` stays empty (no external audiobook platform
 * integration exists yet) and there is no merchandise field on this
 * schema to populate (a Shopify/Story-World relationship is later,
 * separate work — see the Shopify integration audit).
 */
export const SAVANNAH_SEVEN_STORY_WORLD: StoryWorldDoc = {
  _id: "seed-story-world-savannah-seven",
  title: "Zulu the Zebra & The Savannah Seven",
  slug: { current: "savannah-seven" },
  key: "zulu",
  tagline: "Stories inspired by Zulu the Zebra and the Savannah Seven.",
  shortDescription:
    "Stories inspired by Zulu the Zebra and the Savannah Seven.",
  formats: ["audiobooks"],
  status: "in-development",
  heroImage: localImage(
    "/images/story-worlds/savannah-seven/hero.png",
    "Zulu the Zebra and the Savannah Seven, gathered beneath the Moral Tree",
  ),
  synopsis: richText(
    "Zulu the Zebra and the Savannah Seven — Zala, Nara, Mango, Lulu, Sid, Rocky, and Kofi — are Moral Tree Media's first Story World.",
    "Stories from this world are in development.",
  ),
  gallery: [
    localImage(
      "/images/characters/full-cast/full-cast-01-group-portrait.png",
      "Zulu and the whole cast gathered together for a group portrait",
    ),
    localImage(
      "/images/characters/full-cast/full-cast-09-storytime-circle.png",
      "Zulu and the whole cast gathered around an open storybook",
    ),
  ],
  characterRoster,
  audiobookContentRefs: [],
  featured: true,
  internalNotes:
    "Seed/fallback content (temporary, not Sanity — see this file's " +
    "doc comment). Real, owner-approved character and hero art; no " +
    "audiobook catalogue, merchandise, or campaign links wired yet.",
};

/** Ordered list of Story Worlds with real, production-visible seed
 * content — add to this array (never by editing page/route code) as
 * each additional Story World gets real approved assets. */
export const STORY_WORLD_REGISTRY: StoryWorldDoc[] = [
  SAVANNAH_SEVEN_STORY_WORLD,
];

export function getStoryWorldFromRegistry(
  slug: string,
): StoryWorldDoc | undefined {
  return STORY_WORLD_REGISTRY.find((world) => world.slug.current === slug);
}

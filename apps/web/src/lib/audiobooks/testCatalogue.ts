import {
  getCharacter,
  getCharacterPose,
  CANONICAL_CAST_ORDER,
  type CharacterSlug,
  type WebsitePoseRole,
} from "@/lib/characters";
import type {
  AudiobookStory,
  AudiobookStoryWorld,
  AudiobookSeason,
} from "./types";

/**
 * TEMPORARY front-end test data for the `/audiobooks/listen` carousel/
 * player — not approved content, not a second CMS. Replace by pointing
 * `catalogue.ts` at the real published-content backend; nothing else
 * needs to change.
 *
 * Shape is fixed by the build brief: one Story World (the only one with
 * real approved assets — River Rangers etc. are deliberately not stubbed,
 * same rule as `lib/storyWorlds/registry.ts`), five seasons, exactly 30
 * stories per season (6 cards per page → 5 pages).
 *
 * Copy: Season 1's first six titles are the ones from the approved
 * carousel prototype; every other title is an explicit
 * "Placeholder story NN" rather than invented story canon. Artwork reuses
 * the approved character website poses already shipped under
 * `public/images/characters/` — no new assets.
 *
 * Audio: no real narration exists anywhere yet. In development builds
 * each story points at a same-origin, synthesised test signal (see
 * `app/audiobooks/listen/test-signal/route.ts`, which 404s in
 * production) so the player controls can be exercised; in production
 * builds `src` is `null` and the player shows its "not available yet"
 * state.
 */

export const TEST_SEASON_COUNT = 5;
export const TEST_STORIES_PER_SEASON = 30;

const STORY_WORLD_SLUG = "savannah-seven";

// From the approved carousel prototype (mtm-carousel-reference, App.jsx),
// paired with the character each title names so the card art matches.
const PROTOTYPE_TITLES: Array<{ title: string; character: CharacterSlug }> = [
  { title: "Zulu Finds His Stripes", character: "zulu" },
  { title: "Nara and the Moonlit Path", character: "nara" },
  { title: "Mango's Quiet Surprise", character: "mango" },
  { title: "Lulu and the Fireflies", character: "lulu" },
  { title: "Sid Learns to Wait", character: "sid" },
  { title: "Rocky's Gentle Race", character: "rocky" },
];

// Portrait-friendly poses only (the card is a 4:5 portrait crop).
const CARD_POSES: WebsitePoseRole[] = [
  "front-portrait",
  "sitting-look-up",
  "playful-tilt",
  "three-quarter-wave",
  "standing-full-body",
];

const PLACEHOLDER_SYNOPSIS =
  "Placeholder synopsis — the real story description will come from the published-content backend.";

function isDevelopmentBuild(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Deterministic 12–20 minute running time, so cards don't all read
 * identically and server/client renders always agree. */
function testDurationSeconds(seasonNumber: number, storyNumber: number) {
  const minutes = 12 + ((seasonNumber * 7 + storyNumber * 5) % 9);
  const seconds = (storyNumber * 17) % 60;
  return minutes * 60 + seconds;
}

function buildStory(
  seasonNumber: number,
  storyNumber: number,
  globalIndex: number,
): AudiobookStory {
  const prototype =
    seasonNumber === 1 ? PROTOTYPE_TITLES[storyNumber - 1] : undefined;
  const characterSlug =
    prototype?.character ??
    CANONICAL_CAST_ORDER[globalIndex % CANONICAL_CAST_ORDER.length];
  const poseRole =
    CARD_POSES[
      Math.floor(globalIndex / CANONICAL_CAST_ORDER.length) % CARD_POSES.length
    ];
  const pose =
    getCharacterPose(characterSlug, poseRole) ??
    getCharacter(characterSlug).websitePoses[0];

  const id = `${STORY_WORLD_SLUG}-s${seasonNumber}-e${String(storyNumber).padStart(2, "0")}`;

  return {
    id,
    number: storyNumber,
    title:
      prototype?.title ??
      `Placeholder story ${String(storyNumber).padStart(2, "0")}`,
    synopsis: PLACEHOLDER_SYNOPSIS,
    artwork: { src: pose.path, alt: pose.alt },
    audio: {
      src: isDevelopmentBuild()
        ? `/audiobooks/listen/test-signal?story=${encodeURIComponent(id)}`
        : null,
      durationSeconds: testDurationSeconds(seasonNumber, storyNumber),
      isTestSignal: isDevelopmentBuild(),
    },
    status: "published",
    isPlaceholder: true,
  };
}

export function buildTestStoryWorlds(): AudiobookStoryWorld[] {
  const seasons: AudiobookSeason[] = [];
  let globalIndex = 0;
  for (let s = 1; s <= TEST_SEASON_COUNT; s++) {
    const stories: AudiobookStory[] = [];
    for (let n = 1; n <= TEST_STORIES_PER_SEASON; n++) {
      stories.push(buildStory(s, n, globalIndex++));
    }
    seasons.push({
      id: `${STORY_WORLD_SLUG}-s${s}`,
      number: s,
      title: `Season ${s}`,
      stories,
    });
  }

  return [
    {
      id: STORY_WORLD_SLUG,
      slug: STORY_WORLD_SLUG,
      title: "Zulu the Zebra & The Savannah Seven",
      seasons,
    },
  ];
}

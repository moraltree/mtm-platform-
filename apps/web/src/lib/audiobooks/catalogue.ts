import { buildTestStoryWorlds } from "./testCatalogue";
import type {
  AudiobookCatalogue,
  AudiobookSeason,
  AudiobookStoryWorld,
} from "./types";

/**
 * The one read path the customer-facing audiobook experience uses.
 *
 * Today it wraps temporary test data; swapping in the real published-
 * content backend means replacing `loadStoryWorlds()` only. The
 * published-only filter below stays regardless — it's a defence in
 * depth so a draft or in-review story can never reach a listener even if
 * a future backend query forgets to filter. Seasons left with no
 * published stories, and Story Worlds left with no seasons, are dropped
 * rather than rendered empty.
 */

async function loadStoryWorlds(): Promise<{
  storyWorlds: AudiobookStoryWorld[];
  isTestContent: boolean;
}> {
  return { storyWorlds: buildTestStoryWorlds(), isTestContent: true };
}

export function onlyPublished(
  storyWorlds: AudiobookStoryWorld[],
): AudiobookStoryWorld[] {
  return storyWorlds
    .map((world) => ({
      ...world,
      seasons: world.seasons
        .map((season): AudiobookSeason => ({
          ...season,
          stories: season.stories.filter(
            (story) => story.status === "published",
          ),
        }))
        .filter((season) => season.stories.length > 0),
    }))
    .filter((world) => world.seasons.length > 0);
}

export async function getPublishedAudiobookCatalogue(): Promise<AudiobookCatalogue> {
  const { storyWorlds, isTestContent } = await loadStoryWorlds();
  return { storyWorlds: onlyPublished(storyWorlds), isTestContent };
}

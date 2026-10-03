import type {
  AudiobookCatalogue,
  AudiobookSeason,
  AudiobookStory,
  AudiobookStoryWorld,
} from "./types";

/**
 * Pure, client-safe helpers for moving around an `AudiobookCatalogue`
 * (pagination, lookup, previous/next). Kept separate from `catalogue.ts`
 * so client components can import them without pulling the server-side
 * data source (and its temporary test-data builder) into the browser
 * bundle.
 */

/** Cards shown per carousel page — fixed by the build brief (30 stories
 * per season → 5 pages). */
export const STORIES_PER_PAGE = 6;

/** Number of carousel pages a season needs. */
export function pageCount(season: AudiobookSeason): number {
  return Math.max(1, Math.ceil(season.stories.length / STORIES_PER_PAGE));
}

/** The stories on one (0-based) carousel page. */
export function storiesOnPage(
  season: AudiobookSeason,
  pageIndex: number,
): AudiobookStory[] {
  const start = pageIndex * STORIES_PER_PAGE;
  return season.stories.slice(start, start + STORIES_PER_PAGE);
}

/** The (0-based) page a story sits on within its season. */
export function pageIndexOfStory(
  season: AudiobookSeason,
  storyId: string,
): number {
  const index = season.stories.findIndex((s) => s.id === storyId);
  return index < 0 ? 0 : Math.floor(index / STORIES_PER_PAGE);
}

export interface StoryLocation {
  world: AudiobookStoryWorld;
  season: AudiobookSeason;
  story: AudiobookStory;
}

export function findStory(
  catalogue: AudiobookCatalogue,
  storyId: string,
): StoryLocation | undefined {
  for (const world of catalogue.storyWorlds) {
    for (const season of world.seasons) {
      const story = season.stories.find((s) => s.id === storyId);
      if (story) return { world, season, story };
    }
  }
  return undefined;
}

/** The story before/after `storyId` within its Story World, crossing
 * season boundaries (last story of Season 1 → first of Season 2). */
export function adjacentStory(
  catalogue: AudiobookCatalogue,
  storyId: string,
  direction: -1 | 1,
): AudiobookStory | undefined {
  const location = findStory(catalogue, storyId);
  if (!location) return undefined;
  const ordered = location.world.seasons.flatMap((s) => s.stories);
  const index = ordered.findIndex((s) => s.id === storyId);
  return ordered[index + direction];
}

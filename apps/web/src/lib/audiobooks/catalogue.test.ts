import { describe, expect, it } from "vitest";
import { getPublishedAudiobookCatalogue, onlyPublished } from "./catalogue";
import {
  STORIES_PER_PAGE,
  adjacentStory,
  findStory,
  pageCount,
  pageIndexOfStory,
  storiesOnPage,
} from "./navigation";
import { TEST_SEASON_COUNT, TEST_STORIES_PER_SEASON } from "./testCatalogue";
import type { AudiobookStoryWorld } from "./types";

describe("audiobook test catalogue", () => {
  it("has 30 published stories per season across 5 seasons", async () => {
    const catalogue = await getPublishedAudiobookCatalogue();
    expect(catalogue.isTestContent).toBe(true);
    expect(catalogue.storyWorlds).toHaveLength(1);
    const world = catalogue.storyWorlds[0];
    expect(world.seasons).toHaveLength(TEST_SEASON_COUNT);
    for (const season of world.seasons) {
      expect(season.stories).toHaveLength(TEST_STORIES_PER_SEASON);
      expect(season.stories.map((s) => s.number)).toEqual(
        Array.from({ length: 30 }, (_, i) => i + 1),
      );
    }
  });

  it("gives every story a unique ID and real artwork path", async () => {
    const catalogue = await getPublishedAudiobookCatalogue();
    const stories = catalogue.storyWorlds.flatMap((w) =>
      w.seasons.flatMap((s) => s.stories),
    );
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
    for (const story of stories) {
      expect(story.artwork.src).toMatch(/^\/images\/characters\//);
      expect(story.audio.durationSeconds).toBeGreaterThan(0);
    }
  });

  it("uses the approved prototype titles for Season 1's first six stories", async () => {
    const catalogue = await getPublishedAudiobookCatalogue();
    const titles = catalogue.storyWorlds[0].seasons[0].stories
      .slice(0, 6)
      .map((s) => s.title);
    expect(titles[0]).toBe("Zulu Finds His Stripes");
    expect(titles[5]).toBe("Rocky's Gentle Race");
  });
});

describe("pagination", () => {
  it("splits a 30-story season into 5 pages of 6", async () => {
    const catalogue = await getPublishedAudiobookCatalogue();
    const season = catalogue.storyWorlds[0].seasons[0];
    expect(STORIES_PER_PAGE).toBe(6);
    expect(pageCount(season)).toBe(5);
    expect(storiesOnPage(season, 0).map((s) => s.number)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(storiesOnPage(season, 4).map((s) => s.number)).toEqual([
      25, 26, 27, 28, 29, 30,
    ]);
    expect(pageIndexOfStory(season, season.stories[13].id)).toBe(2);
  });
});

describe("navigation", () => {
  it("moves across season boundaries and stops at the ends", async () => {
    const catalogue = await getPublishedAudiobookCatalogue();
    const [s1, s2] = catalogue.storyWorlds[0].seasons;
    const lastOfS1 = s1.stories[29];
    expect(adjacentStory(catalogue, lastOfS1.id, 1)?.id).toBe(s2.stories[0].id);
    expect(adjacentStory(catalogue, s2.stories[0].id, -1)?.id).toBe(
      lastOfS1.id,
    );
    expect(adjacentStory(catalogue, s1.stories[0].id, -1)).toBeUndefined();
    expect(findStory(catalogue, "missing")).toBeUndefined();
  });
});

describe("onlyPublished", () => {
  it("drops unpublished stories, then empty seasons and worlds", () => {
    const story = (id: string, status: "published" | "draft") => ({
      id,
      number: 1,
      title: id,
      synopsis: "",
      artwork: { src: "/x.png", alt: "" },
      audio: { src: null, durationSeconds: 60 },
      status,
    });
    const worlds: AudiobookStoryWorld[] = [
      {
        id: "a",
        slug: "a",
        title: "A",
        seasons: [
          {
            id: "a1",
            number: 1,
            title: "S1",
            stories: [story("pub", "published"), story("draft", "draft")],
          },
          { id: "a2", number: 2, title: "S2", stories: [story("d", "draft")] },
        ],
      },
      {
        id: "b",
        slug: "b",
        title: "B",
        seasons: [
          { id: "b1", number: 1, title: "S1", stories: [story("x", "draft")] },
        ],
      },
    ];
    const result = onlyPublished(worlds);
    expect(result).toHaveLength(1);
    expect(result[0].seasons).toHaveLength(1);
    expect(result[0].seasons[0].stories.map((s) => s.id)).toEqual(["pub"]);
  });
});

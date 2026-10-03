"use client";

import { useRef } from "react";
import { cx } from "@/lib/cx";
import type { AudiobookSeason, AudiobookStory } from "@/lib/audiobooks/types";
import {
  progressFraction,
  type ListeningProgressState,
} from "@/lib/audiobooks/listeningProgress";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { StoryCard } from "./StoryCard";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import styles from "./StoryCarousel.module.css";

/**
 * Season pills + one page of story cards + pagination — the prototype's
 * lower section. Pages rather than free horizontal scroll, so a child (or
 * a sleepy parent) always sees a whole, stable set of cards; a horizontal
 * swipe on touch screens turns the page too.
 */

const SWIPE_THRESHOLD_PX = 50;

export interface StoryCarouselProps {
  seasons: AudiobookSeason[];
  seasonId: string;
  onSeasonChange: (seasonId: string) => void;
  stories: AudiobookStory[];
  pageIndex: number;
  pageTotal: number;
  onPageChange: (pageIndex: number) => void;
  progress: ListeningProgressState;
  activeStoryId: string | null;
  isPlaying: boolean;
  onSelectStory: (storyId: string) => void;
}

export function StoryCarousel({
  seasons,
  seasonId,
  onSeasonChange,
  stories,
  pageIndex,
  pageTotal,
  onPageChange,
  progress,
  activeStoryId,
  isPlaying,
  onSelectStory,
}: StoryCarouselProps) {
  const touchStartX = useRef<number | null>(null);
  const season = seasons.find((s) => s.id === seasonId);
  const goTo = (index: number) =>
    onPageChange(Math.min(Math.max(0, index), pageTotal - 1));

  return (
    <section className={styles.section} aria-labelledby="season-stories">
      <VisuallyHidden as="h2" id="season-stories">
        {season ? `${season.title} stories` : "Stories"}
      </VisuallyHidden>

      <div className={styles.toolbar}>
        <div className={styles.seasons} role="group" aria-label="Seasons">
          {seasons.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cx(
                styles.seasonPill,
                s.id === seasonId && styles.seasonActive,
              )}
              aria-pressed={s.id === seasonId}
              onClick={() => onSeasonChange(s.id)}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => goTo(pageIndex - 1)}
            disabled={pageIndex === 0}
            aria-label="Previous page of stories"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => goTo(pageIndex + 1)}
            disabled={pageIndex >= pageTotal - 1}
            aria-label="Next page of stories"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>

      <ul
        className={styles.grid}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start === null || end === undefined) return;
          const delta = end - start;
          if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
          goTo(pageIndex + (delta < 0 ? 1 : -1));
        }}
      >
        {stories.map((story) => {
          const p = progress.stories[story.id];
          return (
            <li key={story.id} className={styles.item}>
              <StoryCard
                story={story}
                fraction={progressFraction(p)}
                completed={Boolean(p?.completed)}
                isActive={story.id === activeStoryId}
                isPlaying={isPlaying && story.id === activeStoryId}
                onSelect={() => onSelectStory(story.id)}
              />
            </li>
          );
        })}
      </ul>

      <nav className={styles.pagination} aria-label="Story pages">
        {Array.from({ length: pageTotal }, (_, i) => (
          <button
            key={i}
            type="button"
            className={cx(styles.dot, i === pageIndex && styles.dotActive)}
            onClick={() => goTo(i)}
            aria-label={`Page ${i + 1} of ${pageTotal}`}
            aria-current={i === pageIndex ? "page" : undefined}
          >
            {i + 1}
          </button>
        ))}
      </nav>
      <VisuallyHidden as="p" aria-live="polite">
        {season?.title}, page {pageIndex + 1} of {pageTotal}
      </VisuallyHidden>
    </section>
  );
}

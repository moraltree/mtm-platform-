import type { ChangeEvent, ReactNode } from "react";
import type {
  AudiobookSeason,
  AudiobookStory,
  AudiobookStoryWorld,
} from "@/lib/audiobooks/types";
import { ChevronDownIcon, HeadphonesIcon } from "./icons";
import styles from "./StorySelectors.module.css";

/**
 * The prototype's three "STORY WORLD / SEASON / STORY" selector cards.
 * Each is a real native `<select>` styled as a card — keyboard, screen-
 * reader, and iPad picker behaviour come for free instead of a custom
 * listbox. Season mirrors the carousel's season pills (same state);
 * picking a Story makes it the active story in the player.
 */

export interface StorySelectorsProps {
  storyWorlds: AudiobookStoryWorld[];
  worldId: string;
  seasons: AudiobookSeason[];
  seasonId: string;
  stories: AudiobookStory[];
  /** Active story ID if it belongs to the shown season, else `""`. */
  storyId: string;
  onWorldChange: (worldId: string) => void;
  onSeasonChange: (seasonId: string) => void;
  onStoryChange: (storyId: string) => void;
}

export function StorySelectors({
  storyWorlds,
  worldId,
  seasons,
  seasonId,
  stories,
  storyId,
  onWorldChange,
  onSeasonChange,
  onStoryChange,
}: StorySelectorsProps) {
  return (
    <div className={styles.grid}>
      <SelectorCard
        label="Story World"
        value={worldId}
        onChange={(e) => onWorldChange(e.target.value)}
      >
        {storyWorlds.map((w) => (
          <option key={w.id} value={w.id}>
            {w.title}
          </option>
        ))}
      </SelectorCard>
      <SelectorCard
        label="Season"
        value={seasonId}
        onChange={(e) => onSeasonChange(e.target.value)}
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </SelectorCard>
      <SelectorCard
        label="Story"
        value={storyId}
        onChange={(e) => onStoryChange(e.target.value)}
      >
        {storyId === "" && (
          <option value="" disabled>
            Choose a story…
          </option>
        )}
        {stories.map((s) => (
          <option key={s.id} value={s.id}>
            {s.number}. {s.title}
          </option>
        ))}
      </SelectorCard>
    </div>
  );
}

function SelectorCard({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.card}>
      <span className={styles.label}>
        <HeadphonesIcon size={15} />
        {label}
      </span>
      <span className={styles.control}>
        <select className={styles.select} value={value} onChange={onChange}>
          {children}
        </select>
        <ChevronDownIcon size={17} className={styles.chevron} />
      </span>
    </label>
  );
}

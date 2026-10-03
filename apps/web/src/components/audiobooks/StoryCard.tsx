import Image from "next/image";
import { cx } from "@/lib/cx";
import type { AudiobookStory } from "@/lib/audiobooks/types";
import { formatMinutes } from "@/lib/audiobooks/formatTime";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { ProgressBar } from "./ProgressBar";
import { CheckIcon } from "./icons";
import styles from "./StoryCard.module.css";

/**
 * One story in the season carousel: artwork, number, title, running time,
 * and listening state (a progress bar if started, a tick if finished) —
 * the prototype's StoryCard. The whole card is one button that makes the
 * story active in the player; everything inside is phrasing content so
 * the button stays valid and its accessible name stays readable.
 */

export interface StoryCardProps {
  story: AudiobookStory;
  fraction: number;
  completed: boolean;
  isActive: boolean;
  isPlaying: boolean;
  onSelect: () => void;
}

export function StoryCard({
  story,
  fraction,
  completed,
  isActive,
  isPlaying,
  onSelect,
}: StoryCardProps) {
  const started = !completed && fraction > 0;
  return (
    <button
      type="button"
      className={cx(styles.card, isActive && styles.active)}
      onClick={onSelect}
      aria-current={isActive ? "true" : undefined}
    >
      <span className={styles.art}>
        <Image
          src={story.artwork.src}
          alt=""
          fill
          sizes="(min-width: 1024px) 180px, (min-width: 640px) 30vw, 45vw"
        />
        {isActive && (
          <span className={styles.nowBadge}>
            {isPlaying ? "Now playing" : "Selected"}
          </span>
        )}
      </span>
      <span className={styles.number}>{story.number}.</span>
      <span className={styles.title}>{story.title}</span>
      <span className={styles.duration}>
        {formatMinutes(story.audio.durationSeconds)}
      </span>
      <span className={styles.state}>
        {completed && (
          <span className={styles.check}>
            <CheckIcon size={13} />
          </span>
        )}
        {started && <ProgressBar fraction={fraction} className={styles.bar} />}
      </span>
      {completed ? (
        <VisuallyHidden>, finished</VisuallyHidden>
      ) : started ? (
        <VisuallyHidden>
          , {Math.round(fraction * 100)}% listened
        </VisuallyHidden>
      ) : null}
    </button>
  );
}

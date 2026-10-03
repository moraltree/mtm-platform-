import Image from "next/image";
import type { AudiobookStory } from "@/lib/audiobooks/types";
import { formatRemaining } from "@/lib/audiobooks/formatTime";
import { ProgressBar } from "./ProgressBar";
import { PlayIcon } from "./icons";
import styles from "./ContinueListeningCard.module.css";

/**
 * The prototype's slim "Continue Listening" strip under the player:
 * the most recently played unfinished story, with a Resume button. Shows
 * a gentle empty state until something has actually been listened to on
 * this device.
 */

export interface ContinueListeningCardProps {
  story: AudiobookStory | null;
  fraction: number;
  remainingSeconds: number;
  onResume: () => void;
}

export function ContinueListeningCard({
  story,
  fraction,
  remainingSeconds,
  onResume,
}: ContinueListeningCardProps) {
  if (!story) {
    return (
      <div className={styles.card}>
        <div className={styles.thumbEmpty} aria-hidden="true" />
        <div className={styles.body}>
          <p className={styles.heading}>Continue Listening</p>
          <p className={styles.title}>
            Start any story and it&rsquo;ll be waiting for you here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.thumb}>
        <Image src={story.artwork.src} alt="" fill sizes="56px" />
      </div>
      <div className={styles.body}>
        <p className={styles.heading}>Continue Listening</p>
        <p className={styles.title}>{story.title}</p>
        <ProgressBar
          fraction={fraction}
          label={`${story.title}: ${Math.round(fraction * 100)}% listened`}
          className={styles.progress}
        />
      </div>
      <p className={styles.remaining}>{formatRemaining(remainingSeconds)}</p>
      <button
        type="button"
        className={styles.resume}
        onClick={onResume}
        aria-label={`Resume ${story.title}`}
      >
        Resume
        <PlayIcon size={16} />
      </button>
    </div>
  );
}

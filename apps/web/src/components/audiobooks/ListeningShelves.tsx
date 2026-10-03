"use client";

import Image from "next/image";
import { useState } from "react";
import type { AudiobookCatalogue } from "@/lib/audiobooks/types";
import { findStory, type StoryLocation } from "@/lib/audiobooks/navigation";
import {
  inProgressStoryIds,
  libraryStoryIds,
  progressFraction,
  type ListeningProgressState,
  type StoryProgress,
} from "@/lib/audiobooks/listeningProgress";
import { formatRemaining } from "@/lib/audiobooks/formatTime";
import { ProgressBar } from "./ProgressBar";
import { CheckIcon, PlayIcon } from "./icons";
import styles from "./ListeningShelves.module.css";

/**
 * The three destinations from the prototype's top nav that aren't the
 * player itself: Continue Listening (unfinished stories), My Library
 * (everything listened to on this device), and the Parent Area.
 *
 * All three read the browser-local progress store — a development
 * stand-in for account-backed listening history (see
 * `lib/audiobooks/listeningProgress.ts`). The Parent Area is
 * deliberately thin: real parental controls belong with accounts and
 * subscriptions, which aren't built yet, so it only offers what's
 * genuinely true today.
 */

const SHELF_LIMIT = 12;

export interface ListeningShelvesProps {
  catalogue: AudiobookCatalogue;
  progress: ListeningProgressState;
  activeStoryId: string | null;
  isPlaying: boolean;
  onPlayStory: (storyId: string) => void;
  onClearProgress: () => void;
}

export function ListeningShelves({
  catalogue,
  progress,
  activeStoryId,
  isPlaying,
  onPlayStory,
  onClearProgress,
}: ListeningShelvesProps) {
  const resolve = (ids: string[]) =>
    ids
      .map((id) => findStory(catalogue, id))
      .filter((loc): loc is StoryLocation => Boolean(loc));

  const inProgress = resolve(inProgressStoryIds(progress));
  const library = resolve(libraryStoryIds(progress));
  const finishedCount = library.filter(
    (loc) => progress.stories[loc.story.id]?.completed,
  ).length;

  const shelfProps = { progress, activeStoryId, isPlaying, onPlayStory };

  return (
    <div className={styles.shelves}>
      <section
        id="continue-listening"
        className={styles.shelf}
        aria-labelledby="continue-listening-heading"
      >
        <h2 id="continue-listening-heading" className={styles.heading}>
          Continue Listening
        </h2>
        {inProgress.length === 0 ? (
          <p className={styles.empty}>
            Nothing in progress. Stories you start will appear here so you can
            pick up exactly where you left off.
          </p>
        ) : (
          <Shelf items={inProgress.slice(0, SHELF_LIMIT)} {...shelfProps} />
        )}
      </section>

      <section
        id="my-library"
        className={styles.shelf}
        aria-labelledby="my-library-heading"
      >
        <h2 id="my-library-heading" className={styles.heading}>
          My Library
        </h2>
        {library.length === 0 ? (
          <p className={styles.empty}>
            Your library is empty for now. Every story you listen to is kept
            here, finished or not.
          </p>
        ) : (
          <>
            <p className={styles.summary}>
              {library.length - finishedCount} in progress · {finishedCount}{" "}
              finished
            </p>
            <Shelf items={library.slice(0, SHELF_LIMIT)} {...shelfProps} />
          </>
        )}
      </section>

      <ParentArea
        hasHistory={library.length > 0}
        onClearProgress={onClearProgress}
      />
    </div>
  );
}

function Shelf({
  items,
  progress,
  activeStoryId,
  isPlaying,
  onPlayStory,
}: {
  items: StoryLocation[];
  progress: ListeningProgressState;
  activeStoryId: string | null;
  isPlaying: boolean;
  onPlayStory: (storyId: string) => void;
}) {
  return (
    <ul className={styles.list}>
      {items.map(({ season, story }) => {
        const p: StoryProgress | undefined = progress.stories[story.id];
        const fraction = progressFraction(p);
        const nowPlaying = isPlaying && story.id === activeStoryId;
        const remaining = p ? p.durationSeconds - p.positionSeconds : 0;
        return (
          <li key={story.id} className={styles.item}>
            <span className={styles.thumb}>
              <Image src={story.artwork.src} alt="" fill sizes="48px" />
            </span>
            <span className={styles.itemBody}>
              <span className={styles.itemMeta}>
                {season.title} · Story {story.number}
              </span>
              <span className={styles.itemTitle}>{story.title}</span>
              {p?.completed ? (
                <span className={styles.finished}>
                  <CheckIcon size={13} /> Finished
                </span>
              ) : (
                <ProgressBar
                  fraction={fraction}
                  label={`${story.title}: ${Math.round(fraction * 100)}% listened`}
                  className={styles.itemBar}
                />
              )}
            </span>
            {!p?.completed && (
              <span className={styles.itemRemaining}>
                {formatRemaining(remaining)}
              </span>
            )}
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onPlayStory(story.id)}
              disabled={nowPlaying}
              aria-label={
                nowPlaying
                  ? `${story.title} is playing`
                  : `${p?.completed ? "Listen again to" : "Resume"} ${story.title}`
              }
            >
              <PlayIcon size={14} />
              {nowPlaying ? "Playing" : p?.completed ? "Again" : "Resume"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ParentArea({
  hasHistory,
  onClearProgress,
}: {
  hasHistory: boolean;
  onClearProgress: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section
      id="parent-area"
      className={styles.shelf}
      aria-labelledby="parent-area-heading"
    >
      <h2 id="parent-area-heading" className={styles.heading}>
        Parent Area
      </h2>
      <p className={styles.parentText}>
        Accounts, subscriptions and listening controls will live here. For now,
        listening progress is saved only in this browser on this device —
        nothing is sent anywhere.
      </p>
      {hasHistory &&
        (confirming ? (
          <div className={styles.confirmRow}>
            <span className={styles.parentText}>
              Clear all listening progress on this device?
            </span>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => {
                onClearProgress();
                setConfirming(false);
              }}
            >
              Yes, clear it
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setConfirming(true)}
          >
            Clear listening history
          </button>
        ))}
    </section>
  );
}

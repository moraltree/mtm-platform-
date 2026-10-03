"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  AudiobookCatalogue,
  AudiobookStory,
} from "@/lib/audiobooks/types";
import {
  adjacentStory,
  findStory,
  pageCount,
  pageIndexOfStory,
  storiesOnPage,
} from "@/lib/audiobooks/navigation";
import {
  clearListeningProgress,
  inProgressStoryIds,
  progressFraction,
  resumePosition,
  saveStoryProgress,
  useListeningProgress,
} from "@/lib/audiobooks/listeningProgress";
import { useAudioPlayer } from "./useAudioPlayer";
import { StorySelectors } from "./StorySelectors";
import { PlayerPanel } from "./PlayerPanel";
import { ContinueListeningCard } from "./ContinueListeningCard";
import { StoryCarousel } from "./StoryCarousel";
import { ListeningShelves } from "./ListeningShelves";
import styles from "./AudiobookExperience.module.css";

/**
 * The customer-facing audiobook carousel/player — the approved prototype
 * (mtm-carousel-reference) adapted into this app's architecture.
 *
 * State, in two deliberately separate parts:
 *   - *Browsing*: which Story World / Season / carousel page is on
 *     screen. Changing season or page never interrupts playback.
 *   - *Active story*: what the featured player shows. Choosing a story
 *     while something is playing switches playback to it; choosing one
 *     while paused just queues it up.
 *
 * Exactly one `<audio>` element exists (rendered below, controlled by
 * `useAudioPlayer`). Listening progress is saved to the browser-local
 * store every few seconds, on pause, on finishing, on switching story,
 * and when the page is hidden. A finished story stops — no auto-advance —
 * since this is a bedtime product.
 */

const SAVE_INTERVAL_SECONDS = 5;

export interface AudiobookExperienceProps {
  catalogue: AudiobookCatalogue;
}

export function AudiobookExperience({ catalogue }: AudiobookExperienceProps) {
  const progress = useListeningProgress();
  const firstWorld = catalogue.storyWorlds[0];
  const firstSeason = firstWorld?.seasons[0];

  const [worldId, setWorldId] = useState(firstWorld?.id ?? "");
  const [seasonId, setSeasonId] = useState(firstSeason?.id ?? "");
  const [pageIndex, setPageIndex] = useState(0);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(
    firstSeason?.stories[0]?.id ?? null,
  );
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const lastSavedAtRef = useRef(0);

  const {
    audioRef,
    audioProps,
    loadedKey,
    status,
    isPlaying,
    currentTime,
    duration,
    volume,
    volumeSupported,
    load,
    unload,
    play,
    pause,
    seek: seekAudio,
    skip: skipAudio,
    setVolume,
  } = useAudioPlayer({
    onTimeUpdate: (key, time, duration) => {
      if (Math.abs(time - lastSavedAtRef.current) >= SAVE_INTERVAL_SECONDS) {
        lastSavedAtRef.current = time;
        saveStoryProgress(key, time, duration);
      }
    },
    onPause: (key, time, duration) => {
      lastSavedAtRef.current = time;
      saveStoryProgress(key, time, duration);
    },
    onEnded: (key, duration) => saveStoryProgress(key, duration, duration),
  });

  // Save the position if the tab is closed or backgrounded mid-story.
  useEffect(() => {
    const onHide = () => {
      const el = audioRef.current;
      if (
        loadedKey &&
        el &&
        Number.isFinite(el.duration) &&
        el.currentTime > 0
      ) {
        saveStoryProgress(loadedKey, el.currentTime, el.duration);
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [audioRef, loadedKey]);

  // Sleep timer: pause after the chosen number of minutes.
  useEffect(() => {
    if (sleepMinutes === null) return;
    const id = window.setTimeout(() => {
      pause();
      setSleepMinutes(null);
    }, sleepMinutes * 60_000);
    return () => window.clearTimeout(id);
  }, [sleepMinutes, pause]);

  if (!firstWorld || !firstSeason) {
    return (
      <p className={styles.emptyCatalogue}>
        No audiobook stories have been published yet. Please check back soon.
      </p>
    );
  }

  // --- Derived browsing state -------------------------------------------
  const world =
    catalogue.storyWorlds.find((w) => w.id === worldId) ?? firstWorld;
  const season =
    world.seasons.find((s) => s.id === seasonId) ?? world.seasons[0];
  const pageTotal = pageCount(season);
  const currentPage = Math.min(pageIndex, pageTotal - 1);

  // --- Derived active-story state ---------------------------------------
  const activeLocation = activeStoryId
    ? findStory(catalogue, activeStoryId)
    : undefined;
  const activeStory: AudiobookStory =
    activeLocation?.story ?? season.stories[0];
  const activeProgress = progress.stories[activeStory.id];
  const isLoaded = loadedKey === activeStory.id;
  const hasAudio = activeStory.audio.src !== null;
  const displayTime = isLoaded ? currentTime : resumePosition(activeProgress);
  const displayDuration = isLoaded
    ? duration ||
      activeProgress?.durationSeconds ||
      activeStory.audio.durationSeconds
    : activeProgress?.durationSeconds || activeStory.audio.durationSeconds;
  const previousStory = adjacentStory(catalogue, activeStory.id, -1);
  const nextStory = adjacentStory(catalogue, activeStory.id, 1);

  const continueId = inProgressStoryIds(progress)[0];
  const continueStory = continueId
    ? (findStory(catalogue, continueId)?.story ?? null)
    : null;
  const continueProgress = continueStory
    ? progress.stories[continueStory.id]
    : undefined;

  // --- Actions ----------------------------------------------------------
  function loadStory(
    story: AudiobookStory,
    autoplay: boolean,
    startAt?: number,
  ) {
    if (!story.audio.src) {
      unload();
      return;
    }
    const start = startAt ?? resumePosition(progress.stories[story.id]);
    lastSavedAtRef.current = start;
    load({
      key: story.id,
      src: story.audio.src,
      startAt: start,
      autoplay,
    });
  }

  /** Make a story active (and show it in the carousel). Keeps playing if
   * something was already playing, unless `autoplay` says otherwise. */
  function selectStory(storyId: string, autoplay = isPlaying) {
    const location = findStory(catalogue, storyId);
    if (!location) return;
    setActiveStoryId(storyId);
    setWorldId(location.world.id);
    setSeasonId(location.season.id);
    setPageIndex(pageIndexOfStory(location.season, storyId));
    if (storyId === activeStory.id && isLoaded) {
      if (autoplay && !isPlaying) play();
      return;
    }
    if (autoplay) {
      loadStory(location.story, true);
    } else if (loadedKey) {
      // Something else is loaded but paused — unload it (its position is
      // saved by the pause callback) so the panel shows the new story.
      unload();
    }
  }

  function togglePlay() {
    if (!hasAudio) return;
    if (!isLoaded) loadStory(activeStory, true);
    else if (isPlaying) pause();
    else play();
  }

  function seek(time: number) {
    if (isLoaded) seekAudio(time);
    else loadStory(activeStory, false, time);
  }

  function skip(delta: number) {
    if (isLoaded) skipAudio(delta);
    else loadStory(activeStory, false, Math.max(0, displayTime + delta));
  }

  function changeWorld(id: string) {
    const next = catalogue.storyWorlds.find((w) => w.id === id);
    if (!next) return;
    setWorldId(next.id);
    setSeasonId(next.seasons[0]?.id ?? "");
    setPageIndex(0);
  }

  function changeSeason(id: string) {
    setSeasonId(id);
    setPageIndex(0);
  }

  function clearProgress() {
    unload();
    clearListeningProgress();
  }

  return (
    <div className={styles.root}>
      {/* The one audio element for the whole experience. */}
      <audio ref={audioRef} preload="none" {...audioProps} />

      <section
        id="story-worlds"
        className={styles.hero}
        aria-label="Featured story"
      >
        <div className={styles.artwork}>
          <Image
            key={activeStory.id}
            src={activeStory.artwork.src}
            alt={activeStory.artwork.alt}
            fill
            priority
            sizes="(min-width: 768px) 38vw, 100vw"
            className={styles.artworkImage}
          />
        </div>

        <div className={styles.details}>
          <StorySelectors
            storyWorlds={catalogue.storyWorlds}
            worldId={world.id}
            seasons={world.seasons}
            seasonId={season.id}
            stories={season.stories}
            storyId={
              season.stories.some((s) => s.id === activeStory.id)
                ? activeStory.id
                : ""
            }
            onWorldChange={changeWorld}
            onSeasonChange={changeSeason}
            onStoryChange={(id) => selectStory(id)}
          />

          <p className={styles.storyMeta}>
            {activeLocation?.season.title ?? season.title} · Story{" "}
            {activeStory.number}
          </p>
          <h2 className={styles.storyTitle}>{activeStory.title}</h2>
          <p className={styles.synopsis}>{activeStory.synopsis}</p>

          <PlayerPanel
            storyTitle={activeStory.title}
            hasAudio={hasAudio}
            isTestSignal={Boolean(activeStory.audio.isTestSignal)}
            status={isLoaded ? status : "idle"}
            currentTime={displayTime}
            duration={displayDuration}
            volume={volume}
            volumeSupported={volumeSupported}
            sleepMinutes={sleepMinutes}
            hasPrevious={Boolean(previousStory)}
            hasNext={Boolean(nextStory)}
            onTogglePlay={togglePlay}
            onSkip={skip}
            onSeek={seek}
            onVolumeChange={setVolume}
            onSleepChange={setSleepMinutes}
            onPrevious={() => previousStory && selectStory(previousStory.id)}
            onNext={() => nextStory && selectStory(nextStory.id)}
          />

          <ContinueListeningCard
            story={continueStory}
            fraction={progressFraction(continueProgress)}
            remainingSeconds={
              continueProgress
                ? continueProgress.durationSeconds -
                  continueProgress.positionSeconds
                : 0
            }
            onResume={() =>
              continueStory && selectStory(continueStory.id, true)
            }
          />
        </div>
      </section>

      <StoryCarousel
        seasons={world.seasons}
        seasonId={season.id}
        onSeasonChange={changeSeason}
        stories={storiesOnPage(season, currentPage)}
        pageIndex={currentPage}
        pageTotal={pageTotal}
        onPageChange={setPageIndex}
        progress={progress}
        activeStoryId={activeStory.id}
        isPlaying={isLoaded && isPlaying}
        onSelectStory={(id) => selectStory(id)}
      />

      <ListeningShelves
        catalogue={catalogue}
        progress={progress}
        activeStoryId={activeStory.id}
        isPlaying={isLoaded && isPlaying}
        onPlayStory={(id) => selectStory(id, true)}
        onClearProgress={clearProgress}
      />
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser-local listening progress for the audiobook player's Continue
 * Listening / My Library views — a DEVELOPMENT stand-in for account-
 * backed persistence. Same localStorage + `useSyncExternalStore` pattern
 * as `lib/cart.ts`/`lib/consent.ts`.
 *
 * Isolated deliberately: every consumer goes through `useListeningProgress`,
 * `saveStoryProgress` and `clearListeningProgress` only, so replacing this
 * with a real per-account backend later means reimplementing those three
 * against an API — no component changes. Nothing here is personal data:
 * only opaque story IDs and playback positions, stored on this device.
 */

export interface StoryProgress {
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  /** Epoch milliseconds of the last save, for "most recent" ordering. */
  updatedAt: number;
}

export interface ListeningProgressState {
  stories: Record<string, StoryProgress>;
}

const STORAGE_KEY = "mtm-audiobook-progress-v1";
const CHANGE_EVENT = "mtm-audiobook-progress-change";
const EMPTY: ListeningProgressState = { stories: {} };

/** Within this many seconds of the end counts as finished — narration
 * outros shouldn't leave a story stuck at "99%" in Continue Listening. */
export const COMPLETION_THRESHOLD_SECONDS = 10;

export function parseProgress(raw: string | null): ListeningProgressState {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as ListeningProgressState).stories !== "object" ||
      (parsed as ListeningProgressState).stories === null
    ) {
      return EMPTY;
    }
    const stories: Record<string, StoryProgress> = {};
    for (const [id, value] of Object.entries(
      (parsed as ListeningProgressState).stories,
    )) {
      if (
        value &&
        typeof value.positionSeconds === "number" &&
        typeof value.durationSeconds === "number" &&
        typeof value.updatedAt === "number"
      ) {
        stories[id] = {
          positionSeconds: Math.max(0, value.positionSeconds),
          durationSeconds: Math.max(0, value.durationSeconds),
          completed: Boolean(value.completed),
          updatedAt: value.updatedAt,
        };
      }
    }
    return { stories };
  } catch {
    return EMPTY;
  }
}

/** Fraction listened, 0–1. */
export function progressFraction(progress: StoryProgress | undefined): number {
  if (!progress) return 0;
  if (progress.completed) return 1;
  if (progress.durationSeconds <= 0) return 0;
  return Math.min(1, progress.positionSeconds / progress.durationSeconds);
}

/** Story IDs that are started-but-unfinished, most recent first. */
export function inProgressStoryIds(state: ListeningProgressState): string[] {
  return Object.entries(state.stories)
    .filter(([, p]) => !p.completed && p.positionSeconds > 0)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .map(([id]) => id);
}

/** Story IDs with any progress at all (started or finished), most recent
 * first. */
export function libraryStoryIds(state: ListeningProgressState): string[] {
  return Object.entries(state.stories)
    .filter(([, p]) => p.completed || p.positionSeconds > 0)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .map(([id]) => id);
}

/** The position to resume a story from — finished stories restart. */
export function resumePosition(progress: StoryProgress | undefined): number {
  if (!progress || progress.completed) return 0;
  return progress.positionSeconds;
}

// Cached parsed state, invalidated on change — useSyncExternalStore needs
// a stable reference between changes (see lib/cart.ts).
let cache: ListeningProgressState | null = null;

function readFromStorage(): ListeningProgressState {
  if (typeof window === "undefined") return EMPTY;
  try {
    return parseProgress(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): ListeningProgressState {
  if (cache === null) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): ListeningProgressState {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  const handle = () => {
    cache = null;
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, handle);
  // Another tab listening on the same device.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) handle();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handle);
    window.removeEventListener("storage", onStorage);
  };
}

function write(state: ListeningProgressState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private browsing) — progress just won't
    // persist; playback itself is unaffected.
  }
  cache = state;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveStoryProgress(
  storyId: string,
  positionSeconds: number,
  durationSeconds: number,
) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) {
    return;
  }
  const completed =
    durationSeconds > 0 &&
    positionSeconds >= durationSeconds - COMPLETION_THRESHOLD_SECONDS;
  const current = getSnapshot();
  write({
    stories: {
      ...current.stories,
      [storyId]: {
        positionSeconds: completed ? durationSeconds : positionSeconds,
        durationSeconds,
        completed,
        updatedAt: Date.now(),
      },
    },
  });
}

export function clearListeningProgress() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — the in-memory reset below still clears the UI.
  }
  cache = EMPTY;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useListeningProgress(): ListeningProgressState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

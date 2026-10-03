"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactEventHandler,
} from "react";

/**
 * The one audio controller for the audiobook experience: it owns a single
 * `<audio>` element (rendered once by `AudiobookExperience`) and swaps its
 * `src` per story, so there are never two competing audio instances.
 *
 * Audio is loaded lazily — only when a listener presses play, resumes,
 * or seeks — so landing on the page never downloads narration.
 *
 * `load({ autoplay: true })` calls `play()` synchronously in the same
 * user gesture that triggered it (iOS Safari refuses `play()` started
 * later, e.g. from a `loadedmetadata` handler); the resume position is
 * applied once metadata arrives.
 */

export type PlayerStatus =
  | "idle" // nothing loaded yet
  | "loading"
  | "ready" // loaded, paused
  | "playing"
  | "error";

export interface LoadRequest {
  /** Opaque identity of what's loaded (the story ID). */
  key: string;
  src: string;
  startAt: number;
  autoplay: boolean;
}

export interface AudioPlayerCallbacks {
  /** Fires on every `timeupdate` while media is loaded. */
  onTimeUpdate?: (key: string, time: number, duration: number) => void;
  onPause?: (key: string, time: number, duration: number) => void;
  onEnded?: (key: string, duration: number) => void;
}

const DEFAULT_VOLUME = 0.8;

// iOS Safari ignores `volume` (hardware buttons only) — detect that once
// so the UI can hide a slider that would do nothing.
let volumeSupportedCache: boolean | null = null;
function getVolumeSupported(): boolean {
  if (volumeSupportedCache === null) {
    try {
      const probe = document.createElement("audio");
      probe.volume = 0.5;
      volumeSupportedCache = probe.volume === 0.5;
    } catch {
      volumeSupportedCache = false;
    }
  }
  return volumeSupportedCache;
}
const noopSubscribe = () => () => {};

export function useAudioPlayer(callbacks: AudioPlayerCallbacks = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingStartRef = useRef<number | null>(null);
  const callbacksRef = useRef(callbacks);
  // Mirrors `loadedKey` for media event handlers, set alongside it in
  // load()/unload() so the very first media events already see it.
  const loadedKeyRef = useRef<string | null>(null);

  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);

  const volumeSupported = useSyncExternalStore(
    noopSubscribe,
    getVolumeSupported,
    () => true,
  );

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = DEFAULT_VOLUME;
  }, []);

  // Report the outgoing story's position synchronously before its `src`
  // is replaced: the element's own `pause` event fires asynchronously,
  // after the swap, when that position is already gone (onPause below
  // ignores it then, as the duration is no longer finite).
  const flushOutgoing = useCallback((el: HTMLAudioElement) => {
    const key = loadedKeyRef.current;
    if (
      key &&
      Number.isFinite(el.duration) &&
      el.currentTime > 0 &&
      !el.ended
    ) {
      callbacksRef.current.onPause?.(key, el.currentTime, el.duration);
    }
  }, []);

  const load = useCallback(
    (request: LoadRequest) => {
      const el = audioRef.current;
      if (!el) return;
      flushOutgoing(el);
      el.pause();
      pendingStartRef.current = request.startAt > 0 ? request.startAt : null;
      loadedKeyRef.current = request.key;
      setLoadedKey(request.key);
      setCurrentTime(request.startAt);
      setDuration(0);
      setStatus("loading");
      el.src = request.src;
      if (request.autoplay) {
        el.play().catch(() => setStatus("ready"));
      }
    },
    [flushOutgoing],
  );

  /** Unload entirely (e.g. switching to a story without audio). */
  const unload = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    flushOutgoing(el);
    el.pause();
    el.removeAttribute("src");
    el.load();
    pendingStartRef.current = null;
    loadedKeyRef.current = null;
    setLoadedKey(null);
    setStatus("idle");
    setCurrentTime(0);
    setDuration(0);
  }, [flushOutgoing]);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => setStatus("ready"));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const el = audioRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : time;
    const next = Math.min(Math.max(0, time), max);
    el.currentTime = next;
    setCurrentTime(next);
  }, []);

  const skip = useCallback(
    (deltaSeconds: number) => {
      const el = audioRef.current;
      if (el) seek(el.currentTime + deltaSeconds);
    },
    [seek],
  );

  const setVolume = useCallback((value: number) => {
    const next = Math.min(Math.max(0, value), 1);
    if (audioRef.current) audioRef.current.volume = next;
    setVolumeState(next);
  }, []);

  const currentKey = () => loadedKeyRef.current;

  const onLoadedMetadata: ReactEventHandler<HTMLAudioElement> = (event) => {
    const el = event.currentTarget;
    setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const start = pendingStartRef.current;
    pendingStartRef.current = null;
    if (start !== null && Number.isFinite(el.duration)) {
      // A saved position at the very end means "finished" — restart.
      el.currentTime = start < el.duration - 1 ? start : 0;
    }
    setCurrentTime(el.currentTime);
    if (el.paused) setStatus("ready");
  };

  const onTimeUpdate: ReactEventHandler<HTMLAudioElement> = (event) => {
    const el = event.currentTarget;
    setCurrentTime(el.currentTime);
    const key = currentKey();
    if (key && Number.isFinite(el.duration)) {
      callbacksRef.current.onTimeUpdate?.(key, el.currentTime, el.duration);
    }
  };

  const onPlaying: ReactEventHandler<HTMLAudioElement> = () => {
    setStatus("playing");
  };

  const onWaiting: ReactEventHandler<HTMLAudioElement> = () => {
    setStatus("loading");
  };

  const onPause: ReactEventHandler<HTMLAudioElement> = (event) => {
    const el = event.currentTarget;
    // A stale pause from before a src swap — the new media isn't loaded
    // yet, so there's nothing to report and the status must stay
    // "loading".
    if (!Number.isFinite(el.duration)) return;
    setStatus((s) => (s === "error" || s === "idle" ? s : "ready"));
    const key = currentKey();
    if (key && !el.ended) {
      callbacksRef.current.onPause?.(key, el.currentTime, el.duration);
    }
  };

  const onEnded: ReactEventHandler<HTMLAudioElement> = (event) => {
    const el = event.currentTarget;
    setStatus("ready");
    const key = currentKey();
    if (key && Number.isFinite(el.duration)) {
      callbacksRef.current.onEnded?.(key, el.duration);
    }
  };

  const onError: ReactEventHandler<HTMLAudioElement> = (event) => {
    // An error with no src is just `unload()` clearing the element.
    if (event.currentTarget.getAttribute("src")) setStatus("error");
  };

  return {
    audioRef,
    audioProps: {
      onLoadedMetadata,
      onTimeUpdate,
      onPlaying,
      onWaiting,
      onPause,
      onEnded,
      onError,
    },
    loadedKey,
    status,
    isPlaying: status === "playing",
    currentTime,
    duration,
    volume,
    volumeSupported,
    load,
    unload,
    play,
    pause,
    seek,
    skip,
    setVolume,
  };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;

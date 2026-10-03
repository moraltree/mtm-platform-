import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { formatClock, spokenDuration } from "@/lib/audiobooks/formatTime";
import type { PlayerStatus } from "./useAudioPlayer";
import {
  ForwardIcon,
  MoonStarIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
} from "./icons";
import styles from "./PlayerPanel.module.css";

/**
 * The large featured player card — purely presentational. All state and
 * the single `<audio>` element live in `AudiobookExperience` /
 * `useAudioPlayer`; this only renders values and reports intents.
 */

export const SKIP_SECONDS = 15;
export const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60] as const;

export interface PlayerPanelProps {
  storyTitle: string;
  /** False when the story has no audio yet — controls disable and an
   * honest notice replaces them. */
  hasAudio: boolean;
  isTestSignal: boolean;
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  volume: number;
  volumeSupported: boolean;
  sleepMinutes: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
  onTogglePlay: () => void;
  onSkip: (deltaSeconds: number) => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onSleepChange: (minutes: number | null) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function PlayerPanel({
  storyTitle,
  hasAudio,
  isTestSignal,
  status,
  currentTime,
  duration,
  volume,
  volumeSupported,
  sleepMinutes,
  hasPrevious,
  hasNext,
  onTogglePlay,
  onSkip,
  onSeek,
  onVolumeChange,
  onSleepChange,
  onPrevious,
  onNext,
}: PlayerPanelProps) {
  const isPlaying = status === "playing";
  const safeDuration = duration > 0 ? duration : 0;
  const position = Math.min(currentTime, safeDuration || currentTime);
  const fill = safeDuration > 0 ? (position / safeDuration) * 100 : 0;
  const remaining = Math.max(0, safeDuration - position);

  return (
    <section className={styles.panel} aria-label="Audio player">
      {!hasAudio ? (
        <p className={styles.notice} role="status">
          Audio for this story isn&rsquo;t available yet. It will play here as
          soon as the narration is published.
        </p>
      ) : status === "error" ? (
        <p className={cx(styles.notice, styles.noticeError)} role="alert">
          This story couldn&rsquo;t be loaded. Please try again in a moment.
        </p>
      ) : isTestSignal ? (
        <p className={styles.testBadge}>
          Development test signal — real narration not yet available
        </p>
      ) : null}

      <div className={styles.transport}>
        <button
          type="button"
          className={styles.skip}
          onClick={() => onSkip(-SKIP_SECONDS)}
          disabled={!hasAudio}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
        >
          <RewindIcon size={34} />
          <span className={styles.skipLabel} aria-hidden="true">
            {SKIP_SECONDS}
          </span>
        </button>

        <button
          type="button"
          className={styles.play}
          onClick={onTogglePlay}
          disabled={!hasAudio}
          aria-label={isPlaying ? `Pause ${storyTitle}` : `Play ${storyTitle}`}
        >
          {isPlaying ? (
            <PauseIcon size={40} />
          ) : (
            <PlayIcon size={42} className={styles.playGlyph} />
          )}
          {status === "loading" && (
            <span className={styles.spinner} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className={styles.skip}
          onClick={() => onSkip(SKIP_SECONDS)}
          disabled={!hasAudio}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
        >
          <ForwardIcon size={34} />
          <span className={styles.skipLabel} aria-hidden="true">
            {SKIP_SECONDS}
          </span>
        </button>
      </div>

      <div className={styles.seekRow}>
        <span className={styles.time}>{formatClock(position)}</span>
        <input
          type="range"
          className={styles.range}
          style={{ "--fill": `${fill}%` } as CSSProperties}
          min={0}
          max={safeDuration || 1}
          step={1}
          value={position}
          onChange={(e) => onSeek(Number(e.target.value))}
          disabled={!hasAudio || safeDuration === 0}
          aria-label="Playback position"
          aria-valuetext={`${spokenDuration(position)} of ${spokenDuration(safeDuration)}`}
        />
        <span className={cx(styles.time, styles.timeEnd)}>
          -{formatClock(remaining)}
        </span>
      </div>

      <div className={styles.utilityRow}>
        <div className={styles.volume}>
          <VolumeIcon size={20} />
          {volumeSupported ? (
            <input
              type="range"
              className={cx(styles.range, styles.volumeRange)}
              style={{ "--fill": `${volume * 100}%` } as CSSProperties}
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              aria-valuetext={`${Math.round(volume * 100)}%`}
            />
          ) : (
            <span className={styles.utilityText}>
              Use your device&rsquo;s volume buttons
            </span>
          )}
        </div>

        <label className={styles.sleep}>
          <MoonStarIcon size={20} />
          <span className={styles.utilityText}>Sleep Timer</span>
          <select
            className={styles.sleepSelect}
            value={sleepMinutes ?? ""}
            onChange={(e) =>
              onSleepChange(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Off</option>
            {SLEEP_TIMER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.storyNav}>
        <button
          type="button"
          className={styles.storyNavButton}
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          <SkipBackIcon size={18} />
          Previous Story
        </button>
        <button
          type="button"
          className={styles.storyNavButton}
          onClick={onNext}
          disabled={!hasNext}
        >
          Next Story
          <SkipForwardIcon size={18} />
        </button>
      </div>
    </section>
  );
}

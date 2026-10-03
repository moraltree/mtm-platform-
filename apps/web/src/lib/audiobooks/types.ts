/**
 * Audiobook content model — Story World → Season → Story.
 *
 * This is the contract the customer-facing `/audiobooks/listen`
 * experience renders against. Today it's fed by temporary front-end test
 * data (`testCatalogue.ts`); later a real published-content backend
 * (Sanity, or the future MTM Control Center — see CLAUDE.md) only needs
 * to produce the same shape through `catalogue.ts#getPublishedAudiobookCatalogue`
 * and nothing under `components/audiobooks/` changes.
 *
 * Everything here is plain, serialisable data (no functions, no Dates)
 * so a Server Component can pass it straight to the client experience.
 * There are deliberately no chapters: a Story is the smallest playable
 * unit.
 */

/** Editorial lifecycle. Only `"published"` stories ever reach the
 * customer-facing interface — see `catalogue.ts`. */
export type PublicationStatus =
  "draft" | "in-review" | "approved" | "published";

export interface AudiobookArtwork {
  /** Public path or absolute URL, ready for `next/image`. */
  src: string;
  alt: string;
}

export interface AudiobookAudio {
  /** Same-origin or allowed URL of the narration file, or `null` when no
   * audio exists yet — the player renders an honest "not available yet"
   * state rather than a broken control. */
  src: string | null;
  /** Editorial running time, used on cards before any media has loaded.
   * The player itself trusts the media element's own duration once
   * metadata arrives. */
  durationSeconds: number;
  /** True when `src` is a development test signal rather than real
   * narration, so the player can label it as such. */
  isTestSignal?: boolean;
}

export interface AudiobookStory {
  id: string;
  /** 1-based position within its season. */
  number: number;
  title: string;
  synopsis: string;
  artwork: AudiobookArtwork;
  audio: AudiobookAudio;
  status: PublicationStatus;
  /** True for temporary test content, so nothing downstream mistakes it
   * for approved copy. */
  isPlaceholder?: boolean;
}

export interface AudiobookSeason {
  id: string;
  number: number;
  title: string;
  stories: AudiobookStory[];
}

export interface AudiobookStoryWorld {
  id: string;
  slug: string;
  title: string;
  seasons: AudiobookSeason[];
}

export interface AudiobookCatalogue {
  storyWorlds: AudiobookStoryWorld[];
  /** True while the catalogue is temporary test data — drives the
   * on-page "preview content" notice. */
  isTestContent: boolean;
}

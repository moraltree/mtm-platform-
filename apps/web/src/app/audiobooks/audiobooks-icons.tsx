/**
 * Route-local hero icon for the Audiobooks proposition shell — same
 * inline SVG as home-icons.tsx's HeadphonesIcon (kept as a separate copy
 * rather than a cross-route import, matching that file's own
 * "route-local, not shared" framing). aria-hidden since PropositionShell
 * always pairs it with a visible heading.
 */

export function HeadphonesIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 13a9 9 0 0 1 18 0" />
      <rect x="3" y="13" width="5" height="7" rx="1.5" />
      <rect x="16" y="13" width="5" height="7" rx="1.5" />
    </svg>
  );
}

/** Placeholder hero-visual icon: a play button, standing in for a real
 * sample player until audio production exists — see page.tsx's
 * `heroVisualLabel`. */
export function PlayCircleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5v-7Z" />
    </svg>
  );
}

/**
 * Route-local hero icon for the Animation proposition shell — same
 * inline SVG as home-icons.tsx's FilmIcon (kept as a separate copy
 * rather than a cross-route import, matching that file's own
 * "route-local, not shared" framing). aria-hidden since PropositionShell
 * always pairs it with a visible heading.
 */

export function FilmIcon() {
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
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M7 4.5v15M17 4.5v15M2.5 9.5H7M17 9.5h4.5M2.5 14.5H7M17 14.5h4.5" />
    </svg>
  );
}

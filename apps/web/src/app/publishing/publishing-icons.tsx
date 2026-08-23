/**
 * Route-local hero icon for the Publishing proposition shell — same inline
 * SVG as home-icons.tsx's BookIcon (kept as a separate copy rather than a
 * cross-route import, matching that file's own "route-local, not shared"
 * framing). aria-hidden since PropositionShell always pairs it with a
 * visible heading.
 */

export function BookIcon() {
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
      <path d="M4 19.5V5a2 2 0 0 1 2-2h13v15.5H6.5A2.5 2.5 0 0 0 4 21v0a2.5 2.5 0 0 1-2.5-2.5" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19" />
    </svg>
  );
}

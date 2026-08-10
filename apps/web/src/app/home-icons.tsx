/**
 * Small decorative line icons for the homepage's three-medium section
 * (Publishing / Audiobooks / Animation). Inline SVG rather than files
 * under `next/image` — no real iconography/brand assets exist yet (see
 * CLAUDE.md's placeholder-palette note), and `next/image` blocks SVG
 * sources by default anyway (XSS risk, deliberately not overridden — see
 * CLAUDE.md). Each renders `aria-hidden` since it's always paired with a
 * visible text heading that already carries the accessible name.
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

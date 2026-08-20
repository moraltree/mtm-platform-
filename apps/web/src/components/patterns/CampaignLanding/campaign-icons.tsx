/**
 * Small decorative line icons for CampaignLanding — same inline-SVG
 * convention as app/home-icons.tsx (no next/image, no uploaded SVG file:
 * next/image blocks SVG sources by default and that's deliberately not
 * overridden — see CLAUDE.md). Every icon here is always paired with
 * visible text that already carries the accessible name, so each is
 * `aria-hidden`.
 */

const iconProps = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function AudiobookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 13a9 9 0 0 1 18 0" />
      <rect x="3" y="13" width="5" height="7" rx="1.5" />
      <rect x="16" y="13" width="5" height="7" rx="1.5" />
    </svg>
  );
}

export function FamilyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5v0a5 5 0 0 1 5 5v1" />
      <path d="M14.5 14.2a4 4 0 0 1 5.5 3.7V19" />
    </svg>
  );
}

export function BedIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 18v2M21 18v2M3 13V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg {...iconProps}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function TabletIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg {...iconProps}>
      <rect x="6" y="2.5" width="12" height="19" rx="4" />
      <circle cx="12" cy="15" r="3.2" />
      <path d="M12 6.2h.01" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5Z" />
      <path d="m9.5 12 1.8 1.8L14.8 10" />
    </svg>
  );
}

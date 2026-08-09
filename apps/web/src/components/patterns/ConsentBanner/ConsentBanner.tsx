"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  CONSENT_CHANGE_EVENT,
  getStoredConsent,
  setStoredConsent,
  type ConsentChoice,
} from "@/lib/consent";
import styles from "./ConsentBanner.module.css";

export interface ConsentBannerProps {
  message?: string;
  policyHref?: string;
  policyLabel?: string;
}

const DEFAULT_MESSAGE =
  "We use essential cookies to run this site. We don't set analytics or marketing cookies without your consent.";

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Server/first-hydration-pass snapshot is always "no choice yet" (`null`)
// — localStorage doesn't exist on the server, and useSyncExternalStore
// uses this value during hydration specifically to avoid a mismatch
// against the real (possibly different) client value, which React then
// reconciles in a follow-up render. This is the sanctioned pattern for
// syncing with browser-only storage — see React's docs on
// useSyncExternalStore — and avoids a manual setState-in-effect.
function getServerSnapshot(): ConsentChoice | null {
  return null;
}

export function ConsentBanner({
  message = DEFAULT_MESSAGE,
  policyHref,
  policyLabel = "Cookie policy",
}: ConsentBannerProps) {
  const choice = useSyncExternalStore(
    subscribe,
    getStoredConsent,
    getServerSnapshot,
  );

  if (choice !== null) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Cookie consent">
      <p className={styles.message}>
        {message}{" "}
        {policyHref && (
          <Link href={policyHref} className={styles.link}>
            {policyLabel}
          </Link>
        )}
      </p>
      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          className={styles.declineButton}
          onClick={() => setStoredConsent("declined")}
        >
          Decline
        </Button>
        <Button
          type="button"
          variant="primary"
          className={styles.acceptButton}
          onClick={() => setStoredConsent("accepted")}
        >
          Accept
        </Button>
      </div>
    </div>
  );
}

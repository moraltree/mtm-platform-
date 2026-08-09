"use client";

import { useEffect } from "react";

/**
 * Replaces the *entire* root layout (including <html>/<body>) if
 * layout.tsx itself throws — e.g. its siteSettings fetch. Deliberately
 * minimal and self-contained: it must not depend on anything that could
 * be the reason the root layout failed (design-system CSS, another
 * Sanity fetch, etc.).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "3rem 1.5rem",
          maxWidth: "32rem",
          margin: "0 auto",
        }}
      >
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Please try again.</p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  );
}

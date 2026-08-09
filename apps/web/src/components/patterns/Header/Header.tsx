"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { cx } from "@/lib/cx";
import styles from "./Header.module.css";

export interface HeaderNavItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface HeaderProps {
  siteTitle: string;
  nav: HeaderNavItem[];
}

/**
 * WAI-ARIA APG "disclosure navigation" pattern: a toggle button reveals a
 * nav list on narrow viewports; above the `md` breakpoint the list is
 * always visible and the toggle is hidden via CSS (no JS branching needed
 * for desktop — the same markup serves both).
 */
export function Header({ siteTitle, nav }: HeaderProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <Link href="/" className={styles.brand}>
          {siteTitle}
        </Link>

        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <VisuallyHidden>{open ? "Close menu" : "Open menu"}</VisuallyHidden>
          <span
            className={cx(styles.icon, open && styles.iconOpen)}
            aria-hidden="true"
          />
        </button>

        <nav
          id="primary-nav"
          aria-label="Primary"
          className={cx(styles.nav, open && styles.navOpen)}
        >
          <ul className={styles.navList}>
            {nav.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    className={styles.navLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className={styles.navLink}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </header>
  );
}

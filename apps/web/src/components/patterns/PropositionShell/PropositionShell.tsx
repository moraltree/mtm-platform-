import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "./PropositionShell.module.css";

/**
 * Shared shell for a capability page that describes something Moral Tree
 * Media is building toward (Publishing, Audiobooks, Animation) rather than
 * something live today — an honest "here's the proposition, here's what's
 * coming" page, not a 404 and not fabricated content (no invented titles,
 * partnerships, or claims that a transactional flow exists when it
 * doesn't). Deliberately a shared `patterns/` component, unlike Home's own
 * bespoke null-state (`app/home.module.css`'s own doc comment): the three
 * consumers share one real structure (badge, heading, intro, feature
 * list, optional "coming soon" note, CTAs) with only copy/icon differing,
 * where Home's null-state copy is homepage-specific and doesn't repeat
 * anywhere else.
 *
 * Each consuming route (Publishing/Audiobooks/Animation) still checks for
 * a real Sanity `page` document first and renders that via `PageSections`
 * when one exists — this shell is only the fallback, exactly the same
 * "CMS wins the instant it exists" precedent Home's own null-state
 * established (see CLAUDE.md's null-handling rule 3 note on Home).
 */

export interface PropositionFeature {
  title: string;
  body: string;
}

export interface PropositionCta {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
  external?: boolean;
}

export interface PropositionShellProps {
  icon: ReactNode;
  eyebrow: string;
  heading: string;
  intro: string;
  features: PropositionFeature[];
  comingSoonNote?: ReactNode;
  ctas?: PropositionCta[];
  /** A secondary, lower-emphasis link row under the CTAs — e.g. "See our
   * first Story World" — rendered as plain text links, not buttons. */
  secondaryLinks?: Array<{ label: string; href: string }>;
}

export function PropositionShell({
  icon,
  eyebrow,
  heading,
  intro,
  features,
  comingSoonNote,
  ctas,
  secondaryLinks,
}: PropositionShellProps) {
  return (
    <Container className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <Badge tone="brand">{eyebrow}</Badge>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.intro}>{intro}</p>
        {ctas && ctas.length > 0 && (
          <div className={styles.ctaRow}>
            {ctas.map((cta) => (
              <Button
                key={cta.href}
                href={cta.href}
                external={cta.external}
                variant={cta.variant ?? "primary"}
                size="lg"
              >
                {cta.label}
              </Button>
            ))}
          </div>
        )}
        {secondaryLinks && secondaryLinks.length > 0 && (
          <p className={styles.secondaryLinks}>
            {secondaryLinks.map((link, i) => (
              <span key={link.href}>
                {i > 0 && " · "}
                <Link href={link.href}>{link.label}</Link>
              </span>
            ))}
          </p>
        )}
      </div>

      <div className={styles.featureGrid}>
        {features.map((feature) => (
          <div key={feature.title} className={styles.featureCard}>
            <h2 className={styles.featureTitle}>{feature.title}</h2>
            <p className={styles.featureBody}>{feature.body}</p>
          </div>
        ))}
      </div>

      {comingSoonNote && (
        <div className={styles.comingSoonNote}>{comingSoonNote}</div>
      )}
    </Container>
  );
}

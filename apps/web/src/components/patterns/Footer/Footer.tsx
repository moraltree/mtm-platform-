import Link from "next/link";
import { Container } from "@/components/ui/Container";
import styles from "./Footer.module.css";

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterProps {
  siteTitle: string;
  nav?: FooterLink[];
  socialLinks?: FooterLink[];
  note?: string;
}

export function Footer({ siteTitle, nav, socialLinks, note }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <p className={styles.brand}>{siteTitle}</p>

        {nav && nav.length > 0 && (
          <nav aria-label="Footer">
            <ul className={styles.navList}>
              {nav.map((item) => (
                <li key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      className={styles.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.href} className={styles.link}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )}

        {socialLinks && socialLinks.length > 0 && (
          <ul className={styles.socialList}>
            {socialLinks.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={styles.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        {note && <p className={styles.note}>{note}</p>}
      </Container>
    </footer>
  );
}

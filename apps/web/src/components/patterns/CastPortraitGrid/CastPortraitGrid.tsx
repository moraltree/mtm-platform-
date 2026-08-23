import Image from "next/image";
import Link from "next/link";
import styles from "./CastPortraitGrid.module.css";

/**
 * The one "Meet the cast" presentation used site-wide (Home, the
 * Savannah Seven Story World detail page, and any future Story World) —
 * previously two independently-drifting implementations (Home's own
 * circle avatars, and a near-identical-but-not-quite circle-avatar copy
 * on the Story World detail page), unified here after a 24 Aug 2026
 * refinement-sprint audit found both. Deliberately generic (plain
 * strings, no `Character`/`CharacterRosterEntry` coupling) so it works
 * equally for `lib/characters.ts`'s typed manifest (Home) and a Sanity
 * `storyWorld.characterRoster` array (the detail page) — each call site
 * maps its own data into `CastPortraitMember[]` and supplies the
 * ordering (see `lib/characters.ts#getCharactersInCanonicalOrder`, the
 * one source of truth for that order).
 *
 * Portrait treatment: a fixed 2:3 card with `object-fit: contain` (never
 * crop — the source art is a natural head-and-shoulders portrait, not a
 * pre-cropped close-up) on a consistent card background, so no character
 * reads smaller than another purely because of image padding/whitespace
 * differences. `href` makes the whole card one link (image alt goes
 * empty in that case — the visible name below already carries the
 * accessible name), matching `Card`'s own "one link, not nested
 * interactive elements" rule.
 */

export interface CastPortraitMember {
  key: string;
  name: string;
  imageSrc?: string;
  imageAlt?: string;
  href?: string;
}

export interface CastPortraitGridProps {
  members: CastPortraitMember[];
}

function PortraitCard({ name, imageSrc, imageAlt, href }: CastPortraitMember) {
  const content = (
    <>
      {imageSrc && (
        <div className={styles.portrait}>
          <Image
            src={imageSrc}
            alt={href ? "" : (imageAlt ?? name)}
            fill
            sizes="8rem"
            className={styles.image}
          />
        </div>
      )}
      <p className={styles.name}>{name}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.member}>
        {content}
      </Link>
    );
  }

  return <div className={styles.member}>{content}</div>;
}

export function CastPortraitGrid({ members }: CastPortraitGridProps) {
  return (
    <>
      <p className={styles.swipeHint} aria-hidden="true">
        Swipe to meet everyone →
      </p>
      <ul className={styles.grid}>
        {members.map((member) => (
          <li key={member.key} className={styles.item}>
            <PortraitCard {...member} />
          </li>
        ))}
      </ul>
    </>
  );
}

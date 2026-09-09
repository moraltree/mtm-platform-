import Image from "next/image";
import {
  getCharacter,
  getCharacterPose,
  type CharacterSlug,
  type WebsitePoseRole,
} from "@/lib/characters";
import { cx } from "@/lib/cx";
import styles from "./CampaignLanding.module.css";

type ClusterTier = "anchor" | "medium" | "small";

export interface HeroCastMember {
  slug: CharacterSlug;
  /** Deliberately not a literal pixel translation of `relativeScale`
   * (lib/characters.ts) — an 8x spread (Zala 1.90 vs Sid 0.25) doesn't
   * make a usable responsive layout. Three clearly stepped tiers instead,
   * assigned by where each character actually falls on the approved
   * scale: Zala/Kofi anchor (the two largest), Rocky/Zulu/Lulu medium,
   * Nara/Mango/Sid small — same relative order, compressed to a
   * practical range. */
  tier: ClusterTier;
  pose: WebsitePoseRole;
}

const TIER_SIZES: Record<ClusterTier, string> = {
  anchor: "(min-width: 64rem) 11rem, 9rem",
  medium: "(min-width: 64rem) 6rem, 5rem",
  small: "(min-width: 64rem) 4.75rem, 4rem",
};

function ClusterPortrait({ slug, pose, tier }: HeroCastMember) {
  const character = getCharacter(slug);
  const image = getCharacterPose(slug, pose);
  if (!character || !image) return null;

  return (
    <div
      className={cx(styles.clusterPortrait, styles[`clusterPortrait_${tier}`])}
    >
      <Image
        src={image.path}
        alt={image.alt}
        fill
        sizes={TIER_SIZES[tier]}
        className={styles.clusterPortraitImage}
      />
    </div>
  );
}

/**
 * One flank of the hero's left/right pairing — one "anchor" (canonically
 * larger) character above a row of smaller companions, so the size
 * hierarchy itself is the composition, not an afterthought. Built from
 * the same already-approved single-character website-pose images used
 * throughout the rest of the site (lib/characters.ts) rather than a
 * single group photo: no existing full-cast/small-group photo in the
 * asset library both satisfies the canonical Zala/Nara/Mango scale *and*
 * shares a background/lighting treatment with the other flank — every
 * individual character image already shares the same warm studio
 * backdrop, which is what actually makes the two flanks read as one
 * composition (see CampaignLanding.module.css's file comment).
 */
export function HeroCastCluster({ members }: { members: HeroCastMember[] }) {
  const anchor = members.find((m) => m.tier === "anchor");
  const companions = members.filter((m) => m.tier !== "anchor");

  return (
    <div className={styles.castCluster}>
      {anchor && <ClusterPortrait {...anchor} />}
      <div className={styles.clusterCompanions}>
        {companions.map((member) => (
          <ClusterPortrait key={member.slug} {...member} />
        ))}
      </div>
    </div>
  );
}

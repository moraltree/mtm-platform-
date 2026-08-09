import type { HeroProps } from "../Hero";
import type { RichTextProps } from "../RichText";
import type { CtaPanelProps } from "../CtaPanel";
import type { MediaProps } from "../Media";
import type { QuoteProps } from "../Quote";
import type { TimelineProps } from "../Timeline";
import type { StatsProps } from "../Stats";
import type { CardGridProps } from "../CardGrid";
import type { ContactFormProps } from "../ContactForm";

/**
 * One entry per apps/studio pageBuilder member (`_type` matches the
 * schema's type name exactly). team/news/story-world grid are CMS-data-
 * driven rather than purely presentational, and PageSections intentionally
 * renders nothing for them — see its switch statement and CLAUDE.md for
 * why (Leadership/News query their own data directly instead of embedding
 * these as pageBuilder blocks; storyWorldGridBlock needs WP6).
 * `formEmbedBlock` is wired to a real form (WP4).
 */
export type PageSection =
  | ({ _type: "heroBlock"; _key: string } & HeroProps)
  | ({ _type: "richTextBlock"; _key: string } & RichTextProps)
  | ({ _type: "ctaPanelBlock"; _key: string } & CtaPanelProps)
  | ({ _type: "mediaBlock"; _key: string } & MediaProps)
  | ({ _type: "quoteBlock"; _key: string } & QuoteProps)
  | ({ _type: "timelineBlock"; _key: string } & TimelineProps)
  | ({ _type: "statsBlock"; _key: string } & StatsProps)
  | ({ _type: "cardGridBlock"; _key: string } & CardGridProps)
  | { _type: "teamGridBlock"; _key: string }
  | { _type: "storyWorldGridBlock"; _key: string }
  | { _type: "newsListBlock"; _key: string }
  | ({
      _type: "formEmbedBlock";
      _key: string;
      form: "contact";
    } & ContactFormProps);

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
 * schema's type name exactly). The middle three (team/story-world/news
 * grid) are CMS-data-driven rather than purely presentational —
 * PageSections intentionally renders nothing for them until WP5/WP6 give
 * them real queries. `formEmbedBlock` is wired to a real form (WP4).
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

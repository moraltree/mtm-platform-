import { Hero } from "../Hero";
import { RichText } from "../RichText";
import { CtaPanel } from "../CtaPanel";
import { Media } from "../Media";
import { Quote } from "../Quote";
import { Timeline } from "../Timeline";
import { Stats } from "../Stats";
import { CardGrid } from "../CardGrid";
import type { PageSection } from "./types";

/**
 * Renders a page's `sections` array (apps/studio's pageBuilder) by
 * dispatching each entry to its matching design-system pattern component.
 * This is the seam every WP5/WP6 page renders through.
 */
export function PageSections({ sections }: { sections: PageSection[] }) {
  return (
    <>
      {sections.map((section) => {
        switch (section._type) {
          case "heroBlock":
            return <Hero key={section._key} {...section} />;
          case "richTextBlock":
            return <RichText key={section._key} {...section} />;
          case "ctaPanelBlock":
            return <CtaPanel key={section._key} {...section} />;
          case "mediaBlock":
            return <Media key={section._key} {...section} />;
          case "quoteBlock":
            return <Quote key={section._key} {...section} />;
          case "timelineBlock":
            return <Timeline key={section._key} {...section} />;
          case "statsBlock":
            return <Stats key={section._key} {...section} />;
          case "cardGridBlock":
            return <CardGrid key={section._key} {...section} />;
          case "teamGridBlock":
          case "storyWorldGridBlock":
          case "newsListBlock":
          case "formEmbedBlock":
            // Data-driven sections — see types.ts. Rendering nothing here
            // is safer than rendering broken/empty UI for a block editors
            // don't yet get real output from.
            return null;
          default:
            return null;
        }
      })}
    </>
  );
}

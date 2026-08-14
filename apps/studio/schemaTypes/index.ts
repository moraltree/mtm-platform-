import { type SchemaTypeDefinition } from "sanity";

// Documents
import page from "./documents/page";
import person from "./documents/person";
import storyWorld from "./documents/storyWorld";
import newsPost from "./documents/newsPost";
import legalPage from "./documents/legalPage";
import siteSettings from "./documents/siteSettings";
import product from "./documents/product";
import order from "./documents/order";

// Objects — shared primitives
import seo from "./objects/seo";
import link from "./objects/link";
import blockContent from "./objects/blockContent";

// Objects — page builder + blocks
import pageBuilder from "./objects/pageBuilder";
import heroBlock from "./objects/heroBlock";
import richTextBlock from "./objects/richTextBlock";
import ctaPanelBlock from "./objects/ctaPanelBlock";
import mediaBlock from "./objects/mediaBlock";
import quoteBlock from "./objects/quoteBlock";
import timelineBlock, { timelineEntry } from "./objects/timelineBlock";
import statsBlock, { statItem } from "./objects/statsBlock";
import cardGridBlock, { cardItem } from "./objects/cardGridBlock";
import teamGridBlock from "./objects/teamGridBlock";
import storyWorldGridBlock from "./objects/storyWorldGridBlock";
import newsListBlock from "./objects/newsListBlock";
import formEmbedBlock from "./objects/formEmbedBlock";

export const schemaTypes: SchemaTypeDefinition[] = [
  // Documents
  page,
  person,
  storyWorld,
  newsPost,
  legalPage,
  siteSettings,
  product,
  order,

  // Shared primitives
  seo,
  link,
  blockContent,

  // Page builder
  pageBuilder,
  heroBlock,
  richTextBlock,
  ctaPanelBlock,
  mediaBlock,
  quoteBlock,
  timelineBlock,
  timelineEntry,
  statsBlock,
  statItem,
  cardGridBlock,
  cardItem,
  teamGridBlock,
  storyWorldGridBlock,
  newsListBlock,
  formEmbedBlock,
];

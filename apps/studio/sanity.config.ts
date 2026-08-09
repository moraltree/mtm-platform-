import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemaTypes";
import { structure } from "./structure";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || "placeholder";
const dataset = process.env.SANITY_STUDIO_DATASET || "production";

export default defineConfig({
  name: "default",
  title: "Moral Tree Media",

  projectId,
  dataset,

  plugins: [
    structureTool({ structure }),
    // GROQ playground — dev/staff tooling only, harmless in production too
    // since it requires Studio auth.
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (prev) => [
      ...prev,
      {
        id: "pageWithId",
        title: "Page (with fixed id)",
        schemaType: "page",
        parameters: [{ name: "pageId", type: "string" }],
        value: (params: { pageId: string }) => ({ pageId: params.pageId }),
      },
    ],
  },
});

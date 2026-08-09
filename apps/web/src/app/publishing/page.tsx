import { EditorialPage, generateEditorialMetadata } from "@/lib/editorialPage";

export const generateMetadata = () => generateEditorialMetadata("publishing");

export default function PublishingPage() {
  return <EditorialPage pageId="publishing" />;
}

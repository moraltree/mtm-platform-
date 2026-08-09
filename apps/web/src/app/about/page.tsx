import { EditorialPage, generateEditorialMetadata } from "@/lib/editorialPage";

export const generateMetadata = () => generateEditorialMetadata("about");

export default function AboutPage() {
  return <EditorialPage pageId="about" />;
}

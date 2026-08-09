import { EditorialPage, generateEditorialMetadata } from "@/lib/editorialPage";

export const generateMetadata = () => generateEditorialMetadata("mission");

export default function MissionPage() {
  return <EditorialPage pageId="mission" />;
}

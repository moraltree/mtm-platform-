import { EditorialPage, generateEditorialMetadata } from "@/lib/editorialPage";

export const generateMetadata = () => generateEditorialMetadata("audiobooks");

export default function AudiobooksPage() {
  return <EditorialPage pageId="audiobooks" />;
}

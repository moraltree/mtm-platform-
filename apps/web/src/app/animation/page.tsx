import { EditorialPage, generateEditorialMetadata } from "@/lib/editorialPage";

export const generateMetadata = () => generateEditorialMetadata("animation");

export default function AnimationPage() {
  return <EditorialPage pageId="animation" />;
}

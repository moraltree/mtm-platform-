import createImageUrlBuilder, {
  type SanityImageSource,
} from "@sanity/image-url";
import { dataset, isSanityConfigured, projectId, useMockContent } from "./env";

const builder = isSanityConfigured
  ? createImageUrlBuilder({ projectId: projectId!, dataset })
  : null;

/** The subset of ImageUrlBuilder's chainable API this codebase actually
 * calls — narrow enough that both the real builder and the mock-content
 * stand-in below satisfy it. */
export interface ImageUrlChain {
  width(px: number): ImageUrlChain;
  height(px: number): ImageUrlChain;
  fit(mode: string): ImageUrlChain;
  url(): string;
}

/** Always resolves to the local placeholder — mock image *refs* (see
 * lib/mockContent.ts) don't point at real Sanity assets, so the real
 * builder can't construct a URL for them even if a project were
 * configured (it isn't, in mock mode). */
function mockImageChain(): ImageUrlChain {
  const chain: ImageUrlChain = {
    width: () => chain,
    height: () => chain,
    fit: () => chain,
    url: () => "/placeholder.png",
  };
  return chain;
}

/**
 * Returns `undefined` when there's no image to show (Sanity unconfigured
 * with mock content off, or `source` falsy), so callers can omit the
 * image entirely rather than crash.
 */
export function urlFor(source: SanityImageSource | undefined | null) {
  if (!source) return undefined;
  if (builder) return builder.image(source) as unknown as ImageUrlChain;
  if (useMockContent) return mockImageChain();
  return undefined;
}

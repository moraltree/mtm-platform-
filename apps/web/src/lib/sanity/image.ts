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

/** Sentinel prefix for a `SanityImageRef` whose `asset._ref` points at a
 * real file under `public/` instead of a Sanity CDN asset — see
 * `lib/storyWorlds/registry.ts`'s `localImage()`. Deliberately checked
 * before the real-builder/mock branches below and unconditionally (not
 * gated on `useMockContent`): this is real, production-visible seed
 * content, not dev-only mock data. No existing real Sanity ref or mock
 * ref (`"image-mock-…"`) can ever match this prefix, so this branch has
 * zero effect on any other image anywhere in the codebase. */
const LOCAL_FILE_PREFIX = "local-file:";

function isLocalFileRef(
  source: SanityImageSource,
): source is { asset: { _ref: string } } {
  const ref = (source as { asset?: { _ref?: string } })?.asset?._ref;
  return typeof ref === "string" && ref.startsWith(LOCAL_FILE_PREFIX);
}

/** Resolves straight to the referenced public/ path, ignoring width/
 * height/fit — there's no server-side resize pipeline for a static file,
 * the same way `next/image` already handles any other local `src`
 * elsewhere in this codebase (e.g. `lib/characters.ts`'s poses). */
function localFileChain(path: string): ImageUrlChain {
  const chain: ImageUrlChain = {
    width: () => chain,
    height: () => chain,
    fit: () => chain,
    url: () => path,
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
  if (isLocalFileRef(source)) {
    return localFileChain(source.asset._ref.slice(LOCAL_FILE_PREFIX.length));
  }
  if (builder) return builder.image(source) as unknown as ImageUrlChain;
  if (useMockContent) return mockImageChain();
  return undefined;
}

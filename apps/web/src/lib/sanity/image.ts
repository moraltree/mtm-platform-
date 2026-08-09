import createImageUrlBuilder, {
  type SanityImageSource,
} from "@sanity/image-url";
import { dataset, isSanityConfigured, projectId } from "./env";

const builder = isSanityConfigured
  ? createImageUrlBuilder({ projectId: projectId!, dataset })
  : null;

/**
 * Returns `undefined` when Sanity isn't configured or `source` is falsy, so
 * callers can fall back to a static/placeholder image rather than crash.
 */
export function urlFor(source: SanityImageSource | undefined | null) {
  if (!builder || !source) return undefined;
  return builder.image(source);
}

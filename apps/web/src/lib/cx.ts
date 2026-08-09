/** Tiny classnames joiner — avoids pulling in a dependency for this alone. */
export function cx(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(" ");
}

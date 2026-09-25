/**
 * Founder Console feature switches. Server-side environment only.
 *
 * Exports have their own default-off switch: the console can be enabled for
 * viewing while every export stays unavailable. All three must be "true".
 */
export const exportsEnabled = () =>
  process.env.ADMIN_EXPORTS_ENABLED === "true" &&
  process.env.ADMIN_ANALYTICS_ENABLED === "true" &&
  process.env.SUBSCRIPTIONS_ENABLED === "true";

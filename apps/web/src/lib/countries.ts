/**
 * Country configuration for the registration form's (optional) country
 * selector — used only when a campaign/market context doesn't already
 * supply one (see `CampaignLandingProps.knownCountry`'s doc comment).
 *
 * Single source of truth (24 Aug 2026 refinement sprint): previously
 * `COUNTRY_OPTIONS` was itself the selectable list — this file now
 * separates the master dataset (`COUNTRIES`, every country this service
 * *could* ever launch into) from what's actually selectable today
 * (`getEnabledCountries()`, filtered on each record's own `enabled`
 * flag). `SignupForm.tsx` is the one and only consumer — it reads
 * `getEnabledCountries()`, never `COUNTRIES` directly, so a country
 * never appears as an option purely because it exists in the dataset.
 *
 * The master list is still the same curated ~22 markets as before, all
 * `enabled: true` — no official launch-country decision exists yet, so
 * nothing here restricts availability that was already there (see the
 * refinement-sprint brief: "preserve current availability rather than
 * arbitrarily restricting it"). Expanding `COUNTRIES` to the full ISO
 * 3166-1 set (~250 territories, most `enabled: false` until a real
 * launch decision) is real future work, not done here — each `code` is
 * already a genuine ISO 3166-1 alpha-2 code, so nothing needs remapping
 * when that expansion happens.
 *
 * **Future MTM Control Center** (see CLAUDE.md's architecture note): the
 * long-term intent is for a country's `enabled` state — and eventually
 * country-specific subscription pricing — to be toggled by a non-
 * engineer through that admin system, not by editing this file. This
 * module is deliberately shaped to make that swap additive rather than a
 * rewrite: `getEnabledCountries()` is the one function every consumer
 * calls, so the day `COUNTRIES` starts coming from a real
 * database/Sanity singleton instead of a static array, only this file's
 * internals change — no call site does.
 */

export interface CountryRecord {
  /** Real ISO 3166-1 alpha-2 code. */
  code: string;
  name: string;
  /** Whether this country is currently selectable in the trial/
   * registration form. Hand-maintained today; see this file's own doc
   * comment for the future Control Center hand-off. */
  enabled: boolean;
}

export const COUNTRIES: CountryRecord[] = [
  { code: "GB", name: "United Kingdom", enabled: true },
  { code: "IE", name: "Ireland", enabled: true },
  { code: "US", name: "United States", enabled: true },
  { code: "CA", name: "Canada", enabled: true },
  { code: "AU", name: "Australia", enabled: true },
  { code: "NZ", name: "New Zealand", enabled: true },
  { code: "FR", name: "France", enabled: true },
  { code: "DE", name: "Germany", enabled: true },
  { code: "ES", name: "Spain", enabled: true },
  { code: "IT", name: "Italy", enabled: true },
  { code: "NL", name: "Netherlands", enabled: true },
  { code: "BE", name: "Belgium", enabled: true },
  { code: "PT", name: "Portugal", enabled: true },
  { code: "SE", name: "Sweden", enabled: true },
  { code: "NO", name: "Norway", enabled: true },
  { code: "DK", name: "Denmark", enabled: true },
  { code: "FI", name: "Finland", enabled: true },
  { code: "CH", name: "Switzerland", enabled: true },
  { code: "AT", name: "Austria", enabled: true },
  { code: "ZA", name: "South Africa", enabled: true },
  { code: "AE", name: "United Arab Emirates", enabled: true },
  { code: "SG", name: "Singapore", enabled: true },
];

/** The one function every country selector should call — never filter
 * `COUNTRIES` ad hoc at the call site, or a future second filter can
 * silently drift from this one. */
export function getEnabledCountries(): CountryRecord[] {
  return COUNTRIES.filter((c) => c.enabled);
}

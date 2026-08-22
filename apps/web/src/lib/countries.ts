/**
 * Country options for the registration form's (optional) country
 * selector — used only when a campaign/market context doesn't already
 * supply one (see `CampaignLandingProps.knownCountry`'s doc comment).
 * A curated list of markets this service is realistically launching
 * into first, not a full ISO 3166-1 enumeration of all ~250 territories
 * — expand as real markets are added. Each `code` is still a real ISO
 * 3166-1 alpha-2 code, so nothing here needs remapping if the list later
 * grows to the full set.
 */
export interface CountryOption {
  code: string;
  name: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
];

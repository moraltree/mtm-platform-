import type {
  AcquisitionSourceField,
  CampaignCustomDomainField,
  CustomDomainField,
  ThemeTokensFields,
} from "../sanity/types";
import type { StoredCampaignStatus } from "../campaignRules";

/**
 * Phase 4 — the typed contract for every operation an authorised admin
 * system will eventually need, per the owner's brief. **Nothing in this
 * file is implemented.** There is no `AdminOperations` object anywhere
 * in this repository that actually performs these — building one
 * against fake/local persistence would be exactly the kind of
 * substitute backend the brief says not to invent. This file exists so
 * that:
 *
 * 1. the *shape* of admin capability is settled and type-checked now,
 *    rather than designed under pressure alongside a real admin UI
 *    later;
 * 2. any future admin surface — a Sanity Studio custom tool, a
 *    dedicated internal app, or something else entirely — has a
 *    concrete target to implement, instead of a prose checklist; and
 * 3. it's obvious, by the total absence of an implementing class here,
 *    that building the real thing is future work, not something this
 *    phase quietly shipped.
 *
 * Every input/output type reuses the exact field shapes already defined
 * in `lib/sanity/types.ts` and `lib/campaignRules.ts` — an admin
 * operation's job is to produce data conforming to those types, not a
 * parallel shape a future implementation would have to reconcile.
 *
 * See CAMPAIGN_PLATFORM_CMS_CONTRACT.md for the prose version of this
 * same contract, including which fields are admin-editable and which
 * are set-once/immutable.
 */

// --- Partner ------------------------------------------------------------

export interface CreatePartnerInput {
  name: string;
  /** Minted once, by whatever creates the record — never edited after
   * (see partner.ts's `key` field comment). */
  key: string;
  slug: string;
  brandingTier: "full-mtm" | "co-branded" | "near-white-label";
  theme?: ThemeTokensFields;
}

export interface UpdatePartnerInput {
  /** Identifies which Partner — never itself editable via this input. */
  key: string;
  name?: string;
  slug?: string;
  brandingTier?: "full-mtm" | "co-branded" | "near-white-label";
  theme?: ThemeTokensFields;
  broughtToByText?: string;
  showBroughtToBy?: boolean;
  poweredByText?: string;
  showPoweredBy?: boolean;
  footerCopy?: string;
  status?: "active" | "inactive";
}

export interface AssignStoryWorldToPartnerInput {
  partnerKey: string;
  storyWorldKey: string;
}

export interface RevokeStoryWorldFromPartnerInput {
  partnerKey: string;
  storyWorldKey: string;
}

export interface ConfigurePartnerDomainInput {
  partnerKey: string;
  domain: CustomDomainField;
}

// --- Story World ----------------------------------------------------------

export interface CreateStoryWorldInput {
  title: string;
  key: string;
  slug: string;
}

export interface UpdateStoryWorldInput {
  key: string;
  title?: string;
  slug?: string;
  theme?: ThemeTokensFields;
  shortDescription?: string;
  /** Reference-by-identifier, not an inline image blob — imagery still
   * has to be uploaded to whatever storage the eventual data source
   * uses; this operation only records which already-uploaded asset a
   * field points at. */
  heroImageRef?: string;
  characterRoster?: Array<{
    name: string;
    portraitRef?: string;
    relativeScale?: number;
    approvedForCampaign?: boolean;
  }>;
  campaignDefaults?: {
    headline?: string;
    supportingCopy?: string;
    ctaLabel?: string;
    benefits?: string[];
    trustCopy?: string;
  };
}

// --- Campaign ---------------------------------------------------------------

export interface CreateCampaignInput {
  title: string;
  /** Minted once — globally unique across the whole platform (owner-
   * confirmed Phase 1 decision), never derived from `slug`. */
  key: string;
  slug: string;
  partnerKey?: string;
  storyWorldKey?: string;
}

export interface UpdateCampaignCopyInput {
  key: string;
  headline?: string;
  subheadline?: string;
  ctaWording?: string;
  supportingCopyOverride?: string;
  /** Reference-by-identifier — see `UpdateStoryWorldInput.heroImageRef`. */
  heroImageOverrideRef?: string;
}

export interface UpdateCampaignThemeInput {
  key: string;
  theme: ThemeTokensFields;
}

export interface UpdateCampaignOfferInput {
  key: string;
  trialLengthDays?: number;
  stripePriceId?: string;
  discountCode?: string;
}

export interface UpdateCampaignDatesInput {
  key: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}

/** The one operation that changes `StoredCampaignStatus` directly — kept
 * separate from copy/theme/offer/date edits so a future admin UI can
 * gate it behind its own confirmation step (activating or archiving a
 * campaign is a bigger deal than editing its headline). */
export interface SetCampaignStatusInput {
  key: string;
  status: StoredCampaignStatus;
}

export interface ActivateCampaignInput {
  key: string;
}
export interface DeactivateCampaignInput {
  key: string;
  /** "paused" (temporary) vs "archived" (permanent) — see
   * lib/campaignRules.ts#StoredCampaignStatus. */
  reason: "pause" | "archive";
}

export interface ManageAcquisitionSourcesInput {
  campaignKey: string;
  sources: AcquisitionSourceField[];
}

export interface CreateShortCodeInput {
  campaignKey: string;
  acquisitionSourceCode: string;
  shortCode: string;
}

export interface ConfigureCampaignDomainInput {
  campaignKey: string;
  domain: CampaignCustomDomainField;
}

export interface SetPermittedStoryWorldsInput {
  partnerKey: string;
  storyWorldKeys: string[];
}

// --- Validation feedback ----------------------------------------------------

/**
 * What "view validation errors before publication" (Phase 4 brief)
 * actually returns — the same shape `lib/theme/contrast.ts`'s
 * `RejectedOverride` already produces for theme fields, generalised so
 * a future admin UI has one consistent error shape across theme,
 * date, and identifier validation rather than a different one per field
 * type.
 */
export interface AdminValidationIssue {
  field: string;
  value: unknown;
  reason: string;
}

export interface AdminValidationResult {
  valid: boolean;
  issues: AdminValidationIssue[];
}

/**
 * The full set of operations described above, as method signatures —
 * exists purely so a future implementation has one interface to
 * implement (and this file has one place where "is everything from the
 * brief accounted for" can be checked at a glance), not because
 * anything constructs an object of this type today.
 */
export interface AdminOperations {
  createPartner(input: CreatePartnerInput): Promise<void>;
  updatePartner(input: UpdatePartnerInput): Promise<void>;
  assignStoryWorldToPartner(
    input: AssignStoryWorldToPartnerInput,
  ): Promise<void>;
  revokeStoryWorldFromPartner(
    input: RevokeStoryWorldFromPartnerInput,
  ): Promise<void>;
  configurePartnerDomain(input: ConfigurePartnerDomainInput): Promise<void>;

  createStoryWorld(input: CreateStoryWorldInput): Promise<void>;
  updateStoryWorld(input: UpdateStoryWorldInput): Promise<void>;

  createCampaign(input: CreateCampaignInput): Promise<void>;
  updateCampaignCopy(input: UpdateCampaignCopyInput): Promise<void>;
  updateCampaignTheme(
    input: UpdateCampaignThemeInput,
  ): Promise<AdminValidationResult>;
  updateCampaignOffer(input: UpdateCampaignOfferInput): Promise<void>;
  updateCampaignDates(
    input: UpdateCampaignDatesInput,
  ): Promise<AdminValidationResult>;
  setCampaignStatus(input: SetCampaignStatusInput): Promise<void>;
  activateCampaign(input: ActivateCampaignInput): Promise<void>;
  deactivateCampaign(input: DeactivateCampaignInput): Promise<void>;
  manageAcquisitionSources(
    input: ManageAcquisitionSourcesInput,
  ): Promise<AdminValidationResult>;
  createShortCode(input: CreateShortCodeInput): Promise<AdminValidationResult>;
  configureCampaignDomain(input: ConfigureCampaignDomainInput): Promise<void>;
  setPermittedStoryWorlds(input: SetPermittedStoryWorldsInput): Promise<void>;
}

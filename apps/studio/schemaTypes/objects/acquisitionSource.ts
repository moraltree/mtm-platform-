import { defineField, defineType } from "sanity";
import { uniqueShortCodeValidation } from "../lib/uniqueShortCode";

/**
 * One named, trackable placement or channel instance scoped to a single
 * `campaign` — e.g. "Chester Zoo gift-shop poster" and "St John's
 * Primary bookmark" are two AcquisitionSource entries under two
 * different campaigns; "Blackpool dentist waiting-room poster" and
 * "Blackpool library poster" are two entries under the *same* campaign.
 * This is the granularity the reporting questions in the architecture
 * proposal ("how many people scanned the Blackpool QR code in the
 * dentist's waiting room specifically?") actually need — a single
 * `channelType: "qr"` bucket per campaign would not answer that.
 *
 * This object only stores the *definition* of a placement (label, the
 * `src=` code it carries, its UTM defaults, its QR short-code). The
 * *events* it generates (scans, clicks, signups, conversions) do not
 * belong here or anywhere else in Sanity — they hand off to the shared
 * platform backend once it exists (see the architecture proposal,
 * "Attribution persistence model"). Do not add scan-count or
 * conversion-count fields to this object; that data has no home in this
 * repository, by design, not by oversight.
 */
export default defineType({
  name: "acquisitionSource",
  title: "Acquisition source",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      description:
        'Human-readable, not shown to visitors — e.g. "Dentist waiting-room poster".',
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "channelType",
      title: "Channel type",
      type: "string",
      options: {
        list: [
          { title: "QR code", value: "qr" },
          { title: "Social", value: "social" },
          { title: "Email", value: "email" },
          { title: "WhatsApp", value: "whatsapp" },
          { title: "Paid ad", value: "paid-ad" },
          { title: "Print", value: "print" },
          { title: "Partner website", value: "partner-site" },
          { title: "Other", value: "other" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "code",
      title: "Source code",
      description:
        'The value carried in ?src= for this placement — short, url-safe, e.g. "bkpl-dentist-3".',
      type: "string",
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9-]+$/, {
          name: "lowercase letters, numbers, hyphens only",
        }),
    }),
    defineField({
      name: "utmDefaults",
      title: "UTM defaults",
      description: "Pre-filled UTM values applied when this placement is used.",
      type: "object",
      fields: [
        defineField({ name: "source", title: "utm_source", type: "string" }),
        defineField({ name: "medium", title: "utm_medium", type: "string" }),
        defineField({
          name: "campaign",
          title: "utm_campaign",
          type: "string",
        }),
        defineField({ name: "content", title: "utm_content", type: "string" }),
      ],
    }),
    defineField({
      name: "shortCode",
      title: "QR short-link code",
      description:
        "Only used when channel type is QR — the path segment for " +
        "/s/[shortCode] (see the architecture proposal's QR-code " +
        "strategy). Generating and printing the actual QR image is a " +
        "later, separate step; this field only reserves the redirect " +
        "target so the destination can change without reprinting. Must " +
        "be unique across every campaign's acquisition sources platform-" +
        "wide — enforced below, not just by convention.",
      type: "string",
      hidden: ({ parent }) =>
        (parent as { channelType?: string } | undefined)?.channelType !== "qr",
      validation: (rule) =>
        rule
          .regex(/^[a-z0-9-]+$/, {
            name: "lowercase letters, numbers, hyphens only",
          })
          .custom(uniqueShortCodeValidation()),
    }),
    defineField({
      name: "active",
      title: "Active",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "code" },
  },
});

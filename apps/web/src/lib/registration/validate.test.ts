import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  optionalBoundedNumber,
  optionalNumber,
  optionalString,
  parseAndValidateRegistration,
  parseConsentInput,
  parseRegistrationFields,
  validateRegistrationFields,
} from "./validate";

function formDataFrom(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("isValidEmail", () => {
  it("accepts a plausible email", () => {
    expect(isValidEmail("parent@example.com")).toBe(true);
  });

  it("rejects a missing @", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});

describe("parseRegistrationFields / validateRegistrationFields", () => {
  it("trims whitespace", () => {
    const values = parseRegistrationFields(
      formDataFrom({
        firstName: "  Ada ",
        lastName: " Lovelace ",
        email: " a@b.com ",
      }),
    );
    expect(values).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "a@b.com",
      country: "",
    });
  });

  it("flags missing required fields", () => {
    const errors = validateRegistrationFields({
      firstName: "",
      lastName: "",
      email: "",
      country: "",
    });
    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
    expect(errors.email).toBeTruthy();
  });

  it("does not require country", () => {
    const errors = validateRegistrationFields({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "a@b.com",
      country: "",
    });
    expect(errors).toEqual({});
  });
});

describe("optionalString", () => {
  it("returns undefined for an absent/empty field", () => {
    expect(optionalString(formDataFrom({}), "partnerId")).toBeUndefined();
  });

  it("caps a tampered/oversized hidden field at maxLength", () => {
    const fd = formDataFrom({ fixedOfferLabel: "x".repeat(500) });
    expect(optionalString(fd, "fixedOfferLabel", 200)).toHaveLength(200);
  });
});

describe("optionalNumber", () => {
  it("parses a valid number", () => {
    expect(
      optionalNumber(
        formDataFrom({ trialLengthDays: "30" }),
        "trialLengthDays",
      ),
    ).toBe(30);
  });

  it("returns undefined for a non-numeric value", () => {
    expect(
      optionalNumber(
        formDataFrom({ trialLengthDays: "thirty" }),
        "trialLengthDays",
      ),
    ).toBeUndefined();
  });
});

describe("optionalBoundedNumber", () => {
  it("accepts a value within range", () => {
    const fd = formDataFrom({ discountPercentage: "25" });
    expect(optionalBoundedNumber(fd, "discountPercentage", 1, 100)).toBe(25);
  });

  it("drops an out-of-range/tampered value rather than forwarding it", () => {
    const fd = formDataFrom({ discountPercentage: "9001" });
    expect(
      optionalBoundedNumber(fd, "discountPercentage", 1, 100),
    ).toBeUndefined();
  });

  it("drops a zero/negative value outside the bound", () => {
    const fd = formDataFrom({ discountPercentage: "0" });
    expect(
      optionalBoundedNumber(fd, "discountPercentage", 1, 100),
    ).toBeUndefined();
  });
});

describe("parseConsentInput", () => {
  it("treats an absent checkbox as unchecked (HTML form semantics)", () => {
    const input = parseConsentInput(formDataFrom({}));
    expect(input).toEqual({
      adultConfirmed: false,
      guardianConfirmed: false,
      legalAccepted: false,
      marketingConsent: false,
    });
  });

  it("treats a present checkbox value as checked", () => {
    const fd = formDataFrom({
      adultConfirmed: "on",
      guardianConfirmed: "on",
      legalAccepted: "on",
      marketingConsent: "on",
    });
    expect(parseConsentInput(fd)).toEqual({
      adultConfirmed: true,
      guardianConfirmed: true,
      legalAccepted: true,
      marketingConsent: true,
    });
  });
});

describe("parseAndValidateRegistration", () => {
  it("is valid when every required field/checkbox is present", () => {
    const fd = formDataFrom({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      adultConfirmed: "on",
      guardianConfirmed: "on",
      legalAccepted: "on",
    });
    const result = parseAndValidateRegistration(fd);
    expect(result.isValid).toBe(true);
    expect(result.fieldErrors).toEqual({});
    expect(result.consentErrors).toEqual({});
  });

  it("is invalid, with both field and consent errors, when everything is missing", () => {
    const result = parseAndValidateRegistration(formDataFrom({}));
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.firstName).toBeTruthy();
    expect(result.consentErrors.adultConfirmed).toBeTruthy();
  });

  it("is invalid when marketing consent is the only checkbox missing — no, marketing is optional", () => {
    const fd = formDataFrom({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      adultConfirmed: "on",
      guardianConfirmed: "on",
      legalAccepted: "on",
      // marketingConsent intentionally omitted
    });
    const result = parseAndValidateRegistration(fd);
    expect(result.isValid).toBe(true);
    expect(result.consentInput.marketingConsent).toBe(false);
  });
});

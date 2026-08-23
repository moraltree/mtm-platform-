import { describe, it, expect } from "vitest";
import { isEnquiryType, parseEnquiryType, ENQUIRY_TYPES } from "./enquiryTypes";

describe("isEnquiryType", () => {
  it("accepts every real key", () => {
    for (const key of Object.keys(ENQUIRY_TYPES)) {
      expect(isEnquiryType(key)).toBe(true);
    }
  });

  it("rejects an arbitrary/unknown string", () => {
    expect(isEnquiryType("not-a-real-type")).toBe(false);
    expect(isEnquiryType("")).toBe(false);
  });
});

describe("parseEnquiryType", () => {
  it("passes through a real known type", () => {
    expect(parseEnquiryType("publishing")).toBe("publishing");
    expect(parseEnquiryType("animation")).toBe("animation");
  });

  it("defaults an unrecognised value to 'general' rather than throwing", () => {
    expect(parseEnquiryType("<script>alert(1)</script>")).toBe("general");
    expect(parseEnquiryType("")).toBe("general");
  });

  it("defaults undefined to 'general'", () => {
    expect(parseEnquiryType(undefined)).toBe("general");
  });
});

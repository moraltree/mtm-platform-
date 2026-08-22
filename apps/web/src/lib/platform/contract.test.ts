import { describe, expect, it } from "vitest";
import { isOfferType } from "./contract";

describe("isOfferType", () => {
  it("accepts every real offer type", () => {
    expect(isOfferType("free-trial")).toBe(true);
    expect(isOfferType("percentage-discount")).toBe(true);
    expect(isOfferType("fixed-offer")).toBe(true);
    expect(isOfferType("reward-linked")).toBe(true);
  });

  it("rejects an arbitrary/tampered string", () => {
    expect(isOfferType("free-trial; DROP TABLE")).toBe(false);
    expect(isOfferType("")).toBe(false);
    expect(isOfferType("FREE-TRIAL")).toBe(false);
  });

  it("rejects an unrecognised future offer type rather than guessing", () => {
    expect(isOfferType("buy-one-get-one")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { getPlanNameFromPriceId } from "./plan-name";

describe("getPlanNameFromPriceId", () => {
  it("returns Standard for missing priceId", () => {
    expect(getPlanNameFromPriceId(undefined, { monthly: "price_m", annual: "price_a" })).toBe(
      "Standard",
    );
  });

  it("returns Monthly for monthly price id", () => {
    expect(getPlanNameFromPriceId("price_m", { monthly: "price_m", annual: "price_a" })).toBe(
      "Monthly",
    );
  });

  it("returns Annual for annual price id", () => {
    expect(getPlanNameFromPriceId("price_a", { monthly: "price_m", annual: "price_a" })).toBe(
      "Annual",
    );
  });

  it("returns Standard for unknown price id", () => {
    expect(getPlanNameFromPriceId("price_other", { monthly: "price_m", annual: "price_a" })).toBe(
      "Standard",
    );
  });

  it("returns Standard when mapping is missing", () => {
    expect(getPlanNameFromPriceId("price_m", {})).toBe("Standard");
  });
});

import { describe, expect, it } from "vitest";
import { amountInWords } from "./amount-in-words";

describe("amountInWords", () => {
  it("handles zero", () => expect(amountInWords(0)).toBe("Rupees Zero Only"));
  it("uses lakh and crore grouping", () => {
    expect(amountInWords(125_000)).toBe("Rupees One Lakh Twenty Five Thousand Only");
    expect(amountInWords(10_000_000)).toBe("Rupees One Crore Only");
  });
  it("says hundreds and teens", () =>
    expect(amountInWords(12_519)).toBe("Rupees Twelve Thousand Five Hundred Nineteen Only"));
  it("adds paise", () => expect(amountInWords(99.5)).toBe("Rupees Ninety Nine and Fifty Paise Only"));
});

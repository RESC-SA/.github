import { describe, it, expect } from "vitest";
import { expandShorthand4, isPercentage, parseLength, parsePercentage } from "../src/mappers/units.js";

describe("parseLength", () => {
  it("parses px", () => expect(parseLength("16px")).toBe(16));
  it("parses rem using root 16", () => expect(parseLength("1rem")).toBe(16));
  it("parses em using given parent", () => expect(parseLength("2em", 10)).toBe(20));
  it("returns null for percent", () => expect(parseLength("50%")).toBeNull());
  it("treats bare numbers as px", () => expect(parseLength("24")).toBe(24));
  it("returns null for auto", () => expect(parseLength("auto")).toBeNull());
});

describe("expandShorthand4", () => {
  it("expands one value", () => expect(expandShorthand4("8px")).toEqual([8, 8, 8, 8]));
  it("expands two values", () => expect(expandShorthand4("8px 4px")).toEqual([8, 4, 8, 4]));
  it("expands three values", () => expect(expandShorthand4("8px 4px 2px")).toEqual([8, 4, 2, 4]));
  it("expands four values", () => expect(expandShorthand4("1px 2px 3px 4px")).toEqual([1, 2, 3, 4]));
});

describe("percentages", () => {
  it("isPercentage", () => expect(isPercentage("100%")).toBe(true));
  it("parsePercentage", () => expect(parsePercentage("50%")).toBe(50));
});

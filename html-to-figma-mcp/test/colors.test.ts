import { describe, it, expect } from "vitest";
import { parseColor } from "../src/mappers/colors.js";

describe("parseColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseColor("#FF0000")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
  it("parses 3-digit hex", () => {
    expect(parseColor("#0f0")).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });
  it("parses 8-digit hex with alpha", () => {
    const c = parseColor("#00000080")!;
    expect(c.r).toBe(0);
    expect(c.a).toBeCloseTo(0.5, 2);
  });
  it("parses rgb()", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
  it("parses rgba() with fractional alpha", () => {
    const c = parseColor("rgba(0, 0, 0, 0.5)")!;
    expect(c.a).toBeCloseTo(0.5);
  });
  it("parses named colors", () => {
    expect(parseColor("white")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor("transparent")!.a).toBe(0);
  });
  it("returns null for unknown input", () => {
    expect(parseColor("not-a-color")).toBeNull();
  });
});

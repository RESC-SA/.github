import { describe, it, expect } from "vitest";
import { extractTokens, toFigmaVariablesExport } from "../src/mappers/tokens.js";

describe("extractTokens", () => {
  it("dedupes colors across inline styles and external CSS", () => {
    const html = '<div style="color: #ff0000"><p style="color: #ff0000">A</p></div>';
    const css = "p { color: #ff0000 }";
    const { colors } = extractTokens(html, css);
    expect(colors.length).toBe(1);
    expect(colors[0]!.hex.toLowerCase().startsWith("#ff0000")).toBe(true);
  });

  it("collects spacing values from padding/margin/gap", () => {
    const html = '<div style="padding: 8px; gap: 16px; margin: 4px"></div>';
    const { spacing } = extractTokens(html);
    const values = spacing.map((s) => s.value).sort((a, b) => a - b);
    expect(values).toEqual([4, 8, 16]);
  });

  it("groups typography signatures", () => {
    const html = '<p style="font-family: Inter; font-size: 14px">a</p><span style="font-family: Inter; font-size: 14px">b</span>';
    const { typography } = extractTokens(html);
    expect(typography.length).toBe(1);
    expect(typography[0]).toMatchObject({ fontFamily: "Inter", fontSize: 14 });
  });

  it("emits Figma Variables export", () => {
    const html = '<div style="color: #123456; padding: 12px"></div>';
    const { figmaVariables } = {
      figmaVariables: toFigmaVariablesExport(extractTokens(html)),
    };
    expect(figmaVariables.variables.some((v) => v.resolvedType === "COLOR")).toBe(true);
    expect(figmaVariables.variables.some((v) => v.resolvedType === "FLOAT")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { cssToFigma, parseDeclarationBlock } from "../src/mappers/cssToFigma.js";

describe("cssToFigma", () => {
  it("maps background and padding", () => {
    const decls = parseDeclarationBlock("background: #FF0000; padding: 16px");
    const { style, warnings } = cssToFigma(decls);
    expect(style.fills).toEqual([{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }]);
    expect(style.paddingTop).toBe(16);
    expect(style.paddingRight).toBe(16);
    expect(style.paddingBottom).toBe(16);
    expect(style.paddingLeft).toBe(16);
    expect(warnings).toEqual([]);
  });

  it("maps flex to HORIZONTAL AUTO_LAYOUT with gap", () => {
    const decls = parseDeclarationBlock("display: flex; flex-direction: row; gap: 12px; justify-content: center");
    const { style } = cssToFigma(decls);
    expect(style.layoutMode).toBe("HORIZONTAL");
    expect(style.itemSpacing).toBe(12);
    expect(style.primaryAxisAlignItems).toBe("CENTER");
  });

  it("maps column flex", () => {
    const { style } = cssToFigma(parseDeclarationBlock("display:flex; flex-direction:column"));
    expect(style.layoutMode).toBe("VERTICAL");
  });

  it("maps border shorthand", () => {
    const { style } = cssToFigma(parseDeclarationBlock("border: 2px solid #000"));
    expect(style.strokeWeight).toBe(2);
    expect(style.strokes).toEqual([{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }]);
  });

  it("maps border-radius single and four values", () => {
    expect(cssToFigma(parseDeclarationBlock("border-radius: 8px")).style.cornerRadius).toBe(8);
    const s = cssToFigma(parseDeclarationBlock("border-radius: 1px 2px 3px 4px")).style;
    expect(s.topLeftRadius).toBe(1);
    expect(s.topRightRadius).toBe(2);
    expect(s.bottomRightRadius).toBe(3);
    expect(s.bottomLeftRadius).toBe(4);
  });

  it("maps box-shadow with color", () => {
    const { style } = cssToFigma(parseDeclarationBlock("box-shadow: 0 2px 4px rgba(0,0,0,0.25)"));
    expect(style.effects?.length).toBe(1);
    expect(style.effects![0]!.type).toBe("DROP_SHADOW");
    expect(style.effects![0]!.offset).toEqual({ x: 0, y: 2 });
    expect(style.effects![0]!.radius).toBe(4);
    expect(style.effects![0]!.color.a).toBeCloseTo(0.25);
  });

  it("maps multiple box-shadows (including inset)", () => {
    const { style } = cssToFigma(parseDeclarationBlock("box-shadow: 0 1px 2px #000, inset 0 0 4px red"));
    expect(style.effects?.length).toBe(2);
    expect(style.effects![1]!.type).toBe("INNER_SHADOW");
  });

  it("maps width 100% to FILL and auto to HUG", () => {
    const a = cssToFigma(parseDeclarationBlock("width: 100%"));
    expect(a.style.layoutSizingHorizontal).toBe("FILL");
    const b = cssToFigma(parseDeclarationBlock("height: auto"));
    expect(b.style.layoutSizingVertical).toBe("HUG");
    const c = cssToFigma(parseDeclarationBlock("width: 240px"));
    expect(c.style.width).toBe(240);
    expect(c.style.layoutSizingHorizontal).toBe("FIXED");
  });

  it("maps typography and color to text fills", () => {
    const { style } = cssToFigma(
      parseDeclarationBlock(
        'font-family: "Helvetica Neue", sans-serif; font-size: 18px; font-weight: bold; line-height: 1.5; color: #333'
      )
    );
    expect(style.typography?.fontFamily).toBe("Helvetica Neue");
    expect(style.typography?.fontSize).toBe(18);
    expect(style.typography?.fontWeight).toBe(700);
    expect(style.typography?.lineHeight).toEqual({ value: 150, unit: "PERCENT" });
    expect(style.textFills?.[0]).toEqual({
      type: "SOLID",
      color: expect.objectContaining({ r: expect.any(Number) }),
    });
  });

  it("warns on unsupported properties", () => {
    const { warnings } = cssToFigma(parseDeclarationBlock("grid-template-columns: 1fr 1fr"));
    expect(warnings.some((w) => w.property === "grid-template-columns")).toBe(true);
  });
});
